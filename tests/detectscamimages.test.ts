import {afterAll, beforeEach, expect, mock, test} from "bun:test";
import fs from "node:fs";
import path from "node:path";
import {Collection} from "discord.js";
import type {GuildSettings, ScamImageStats} from "../src/types";


// In-memory stand-ins for the two stores the detector uses, so the tests never open the real database
const settingsStore = new Map<string, GuildSettings>();
const statsStore = new Map<string, ScamImageStats>();
const fakeStore = <T>(store: Map<string, T>) => ({
    get: (key: string) => Promise.resolve(store.get(key)),
    set: (key: string, value: T) => Promise.resolve(void store.set(key, structuredClone(value))),
});
void mock.module("../src/db", () => ({guildDB: fakeStore(settingsStore), scamImageStatsDB: fakeStore(statsStore)}));
const {default: detector} = await import("../src/events/detectscamimages");

// Generated images (not real ones). One imitates the scam and the other is an ordinary settings screenshot
const fixture = (name: string) => fs.readFileSync(path.join(import.meta.dir, "fixtures", name));
const files: Record<string, Buffer> = {
    "scam.jpg": fixture("fake-scam.jpg"),
    "settings.jpg": fixture("fake-settings.jpg"),
    "broken.jpg": Buffer.from("this is not an image"),
};

// Attachments are downloaded with fetch, so the tests answer those requests from the files above
const downloads: string[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = ((url: string) => {
    const name = path.basename(url);
    downloads.push(name);
    return Promise.resolve(files[name] ? new Response(files[name]) : new Response(null, {status: 404}));
}) as typeof fetch;
afterAll(() => {globalThis.fetch = realFetch;});

const GUILD = "guild1";
const ACCOUNT_ISSUES_CHANNEL = "1465301762821853204";

interface FakeAttachment {
    name: string;
    contentType?: string;
    size?: number;
    width?: number;
    height?: number;
}

interface FakeMessageOptions {
    attachments: FakeAttachment[];
    isModerator?: boolean;
    isDeleteRefused?: boolean;
    isTimeoutRefused?: boolean;
}

const defaultAttachment = {contentType: "image/jpeg", size: 9_000, width: 450, height: 300};

function createMessage({attachments, isModerator = false, isDeleteRefused = false, isTimeoutRefused = false}: FakeMessageOptions) {
    const actions: string[] = [];
    const logged: Array<{title: string; fields: Record<string, string>; description: string; fileNames: string[];}> = [];

    const modlog = {
        isTextBased: () => true,
        send: (payload: {embeds: Array<{toJSON: () => {author?: {name: string;}; description?: string; fields?: Array<{name: string; value: string;}>;};}>; files?: Array<{name: string;}>;}) => {
            const embed = payload.embeds[0].toJSON();
            logged.push({
                title: embed.author?.name ?? "",
                description: embed.description ?? "",
                fields: Object.fromEntries((embed.fields ?? []).map(f => [f.name, f.value])),
                fileNames: (payload.files ?? []).map(f => f.name),
            });
            return Promise.resolve();
        },
    };
    const accountIssues = {
        isTextBased: () => true,
        send: () => Promise.resolve(void actions.push("warned in account issues")),
    };
    const refused = () => Promise.reject(new Error("Missing Permissions"));
    const member = {
        timeout: (duration: number) => isTimeoutRefused ? refused() : Promise.resolve(void actions.push(`timed out for ${duration / 60_000} minutes`)),
    };
    const deleteMessage = () => isDeleteRefused ? refused() : Promise.resolve(void actions.push("deleted"));

    const message = {
        inGuild: () => true,
        url: "https://discord.com/channels/guild1/channel1/message1",
        createdTimestamp: 1_700_000_000_000,
        client: {user: {id: "bot"}},
        author: {
            id: "user1",
            username: "scammer",
            displayName: "Scam Mer",
            tag: "scammer#0",
            toString: () => "<@user1>",
            displayAvatarURL: () => "https://example.com/avatar.png",
        },
        guild: {
            id: GUILD,
            members: {cache: new Collection([["user1", member]])},
            channels: {cache: new Collection<string, unknown>([["modlog", modlog], [ACCOUNT_ISSUES_CHANNEL, accountIssues]])},
        },
        channel: {name: "general", permissionsFor: () => ({has: () => isModerator})},
        attachments: new Collection(attachments.map((a, index) => [String(index), {
            ...defaultAttachment,
            ...a,
            url: `https://cdn.discordapp.com/attachments/1/2/${a.name}`,
        }])),
    };

    // `delete` is added separately because the lint rules want every key quoted in an object that has a reserved word
    return {message: {...message, "delete": deleteMessage}, actions, logged};
}

async function run(options: FakeMessageOptions) {
    const fake = createMessage(options);
    await detector.execute(fake.message as never);
    return fake;
}

/** Runs the detector with `console.error` silenced, for cases where the detector is expected to log a failure. */
async function runQuietly(options: FakeMessageOptions) {
    const realError = console.error;
    console.error = () => {};
    try {
        return await run(options);
    }
    finally {
        console.error = realError;
    }
}

beforeEach(() => {
    settingsStore.clear();
    statsStore.clear();
    downloads.length = 0;
});

test("does nothing, and downloads nothing, when the guild has not turned the detector on", async () => {
    settingsStore.set(GUILD, {modlog: "modlog"});
    const {actions, logged} = await run({attachments: [{name: "scam.jpg"}]});

    expect(downloads).toEqual([]);
    expect(actions).toEqual([]);
    expect(logged).toEqual([]);
});

test("in log mode a scam image is reported to the mod log and nothing else happens", async () => {
    settingsStore.set(GUILD, {modlog: "modlog", scamimages: "log"});
    const {actions, logged} = await run({attachments: [{name: "scam.jpg"}]});

    expect(actions).toEqual([]);
    expect(logged.length).toBe(1);
    expect(logged[0].title).toBe("Scam Image Detected");
    expect(logged[0].description).toContain("[Jump to message](https://discord.com/channels/guild1/channel1/message1)");
    expect(logged[0].fields.Action).toBe("None (log only)");
    expect(logged[0].fields["Matched Terms"]).toContain("casino");
    expect(logged[0].fileNames).toEqual(["flagged.jpg"]);
});

test("in enforce mode a scam image is removed, its author is timed out and warned, and both are logged", async () => {
    settingsStore.set(GUILD, {modlog: "modlog", scamimages: "enforce"});
    const {actions, logged} = await run({attachments: [{name: "scam.jpg"}]});

    expect(actions).toEqual(["deleted", "timed out for 60 minutes", "warned in account issues"]);
    expect(logged.map(entry => entry.title)).toEqual(["Scam Image Detected", "Member Timed Out"]);
    expect(logged[0].fields.Action).toBe("Message removed, member timed out");
    expect(logged[0].description).not.toContain("Jump to message");
});

test("when Discord refuses the timeout, the mod log says so and does not claim the member was timed out", async () => {
    settingsStore.set(GUILD, {modlog: "modlog", scamimages: "enforce"});
    const {actions, logged} = await runQuietly({attachments: [{name: "scam.jpg"}], isTimeoutRefused: true});

    expect(actions).toEqual(["deleted", "warned in account issues"]);
    expect(logged.map(entry => entry.title)).toEqual(["Scam Image Detected"]);
    expect(logged[0].fields.Action).toBe("Message removed, member could not be timed out");
});

test("when Discord refuses the delete, the mod log says so and links to the message that is still there", async () => {
    settingsStore.set(GUILD, {modlog: "modlog", scamimages: "enforce"});
    const {actions, logged} = await runQuietly({attachments: [{name: "scam.jpg"}], isDeleteRefused: true});

    expect(actions).toEqual(["timed out for 60 minutes", "warned in account issues"]);
    expect(logged.map(entry => entry.title)).toEqual(["Scam Image Detected", "Member Timed Out"]);
    expect(logged[0].fields.Action).toBe("Message could not be removed, member timed out");
    expect(logged[0].description).toContain("Jump to message");
});

test("enforce mode still acts when the guild has no mod log", async () => {
    settingsStore.set(GUILD, {scamimages: "enforce"});
    const {actions, logged} = await run({attachments: [{name: "scam.jpg"}]});

    expect(actions).toEqual(["deleted", "timed out for 60 minutes", "warned in account issues"]);
    expect(logged).toEqual([]);
});

test("an ordinary image is read and left alone", async () => {
    settingsStore.set(GUILD, {modlog: "modlog", scamimages: "enforce"});
    const {actions, logged} = await run({attachments: [{name: "settings.jpg"}]});

    expect(downloads).toEqual(["settings.jpg"]);
    expect(actions).toEqual([]);
    expect(logged).toEqual([]);
});

test("a scam image is found behind ordinary ones, and reading stops there", async () => {
    settingsStore.set(GUILD, {modlog: "modlog", scamimages: "enforce"});
    const {actions} = await run({attachments: [{name: "settings.jpg"}, {name: "scam.jpg"}, {name: "settings.jpg"}]});

    expect(downloads).toEqual(["settings.jpg", "scam.jpg"]);
    expect(actions[0]).toBe("deleted");
});

test("someone who can manage messages is never checked", async () => {
    settingsStore.set(GUILD, {modlog: "modlog", scamimages: "enforce"});
    const {actions} = await run({attachments: [{name: "scam.jpg"}], isModerator: true});

    expect(downloads).toEqual([]);
    expect(actions).toEqual([]);
});

test("attachments that are not images, are too large, or have too many pixels are not downloaded", async () => {
    settingsStore.set(GUILD, {modlog: "modlog", scamimages: "enforce"});
    const {actions} = await run({attachments: [
        {name: "scam.jpg", contentType: "application/pdf"},
        {name: "scam.jpg", contentType: undefined},
        {name: "scam.jpg", size: 9 * 1024 * 1024},
        {name: "scam.jpg", width: 5000, height: 4000},
    ]});

    expect(downloads).toEqual([]);
    expect(actions).toEqual([]);
});

test("only the first four images of a message are read", async () => {
    settingsStore.set(GUILD, {modlog: "modlog", scamimages: "enforce"});
    const ordinary = {name: "settings.jpg"};
    const {actions} = await run({attachments: [ordinary, ordinary, ordinary, ordinary, {name: "scam.jpg"}]});

    expect(downloads).toEqual(["settings.jpg", "settings.jpg", "settings.jpg", "settings.jpg"]);
    expect(actions).toEqual([]);
});

test("an image that cannot be downloaded or read is skipped, and the rest are still checked", async () => {
    settingsStore.set(GUILD, {modlog: "modlog", scamimages: "enforce"});
    const {actions} = await runQuietly({attachments: [{name: "missing.jpg"}, {name: "broken.jpg"}, {name: "scam.jpg"}]});

    expect(downloads).toEqual(["missing.jpg", "broken.jpg", "scam.jpg"]);
    expect(actions[0]).toBe("deleted");
});

test("the guild's totals count the images that were read and the messages that were flagged", async () => {
    settingsStore.set(GUILD, {modlog: "modlog", scamimages: "log"});
    await run({attachments: [{name: "settings.jpg"}, {name: "settings.jpg"}]});
    await run({attachments: [{name: "settings.jpg"}, {name: "scam.jpg"}]});
    await run({attachments: [{name: "scam.jpg", contentType: "application/pdf"}]});

    const stats = statsStore.get(GUILD)!;
    expect(stats.imagesScanned).toBe(4);
    expect(stats.messagesFlagged).toBe(1);
    expect(stats.longestWait).toBeGreaterThanOrEqual(0);
});

test("messages scanned at the same time are all counted", async () => {
    settingsStore.set(GUILD, {scamimages: "log"});
    await Promise.all(Array.from({length: 5}, () => run({attachments: [{name: "settings.jpg"}]})));

    expect(statsStore.get(GUILD)!.imagesScanned).toBe(5);
});

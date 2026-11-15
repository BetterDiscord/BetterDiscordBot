import {describe, expect, test} from "bun:test";

import {createAddonComponent, createAddonList, createNavigation, paginateAddonPages, sortAddons} from "../src/util/addons";
import {isSessionId} from "../src/framework";
import type {BdWebAddon} from "../src/types";
import {sessionHarness} from "./helpers/session";


function addon(over: Partial<BdWebAddon> = {}): BdWebAddon {
    return {
        id: 7,
        name: "CoolPlugin",
        file_name: "c.plugin.js",
        type: "plugin",
        description: "Does things",
        version: "1.2.3",
        likes: 1234,
        downloads: 56789,
        tags: [],
        thumbnail_url: "/resources/x.png",
        latest_source_url: "u",
        initial_release_date: new Date("2020-01-02T00:00:00Z"),
        latest_release_date: new Date("2024-03-04T00:00:00Z"),
        author: {
            github_id: "1",
            github_name: "g",
            display_name: "d",
            discord_name: "dn",
            discord_avatar_hash: null,
            discord_snowflake: "1",
            guild: null
        },
        guild: null,
        ...over
    };
}

const IS_COMPONENTS_V2 = 1 << 15;

interface Row {type: number; components: Array<{options?: Array<{label: string; value: string; default: boolean}>; disabled?: boolean}>}
const navOf = (shown: Record<string, unknown>) => (shown.components as unknown[])[0] as Row;
const menu = (shown: Record<string, unknown>) => navOf(shown).components[0];


describe("navigation menu", () => {
    const list = [addon({name: "Alpha"}), addon({name: "Beta"}), addon({name: "Gamma"})];

    test("is session-owned so the dispatcher leaves it alone", () => {
        const control = createNavigation(list).components[0] as {customId: string};
        expect(isSessionId(control.customId)).toBe(true);
    });

    test("numbers the options and marks the selected one", () => {
        const options = menu({components: [createNavigation(list, 1)]}).options ?? [];
        expect(options.map(option => option.label)).toEqual(["1. Alpha", "2. Beta", "3. Gamma"]);
        expect(options.map(option => option.default)).toEqual([false, true, false]);
    });
});


describe("addon browser", () => {
    const list = [addon({name: "Alpha"}), addon({name: "Beta"}), addon({name: "Gamma"})];

    function browse(addons: BdWebAddon[]) {
        const harness = sessionHarness();
        const done = paginateAddonPages(harness.interaction, addons);
        return {harness, done, latest: () => harness.shown.at(-1) ?? {}};
    }

    test("an empty list answers instead of building an illegal select menu", async () => {
        // Discord rejects a string select with zero options.
        const {harness, done} = browse([]);
        await done;
        const shown = harness.shown.at(-1) ?? {};
        expect(Number(shown.flags) & IS_COMPONENTS_V2).toBe(IS_COMPONENTS_V2);
        expect(JSON.stringify(shown)).toContain("No addons matched");
    });

    test("renders the first addon with its menu", async () => {
        const {harness, done} = browse(list);
        await harness.press("addons-navigate", {values: ["Alpha"]});
        const options = menu(harness.shown[0]).options ?? [];
        expect(options).toHaveLength(3);
        expect(options[0]?.default).toBe(true);
        await harness.end();
        await done;
    });

    test("the menu is disabled once the session ends", async () => {
        const {harness, done} = browse(list);
        await harness.press("addons-navigate", {values: ["Alpha"]});
        await harness.end();
        await done;
        expect(menu(harness.shown.at(-1) ?? {}).disabled).toBe(true);
    });

    test("every render carries IsComponentsV2", async () => {
        const {harness, done} = browse(list);
        await harness.press("addons-navigate", {values: ["Alpha"]});
        await harness.end();
        await done;
        expect(harness.shown.every(shown => Number(shown.flags) === IS_COMPONENTS_V2)).toBe(true);
    });

    test("a stranger cannot drive the browser", async () => {
        const {harness, done} = browse(list);
        const refusals = await harness.press("addons-navigate", {userId: "someone-else", values: ["Beta"]});
        expect(String(refusals[0]?.content)).toContain("belongs to someone else");
        await harness.end();
        await done;
    });

    test("selecting an addon swaps the page and moves the tick", async () => {
        const {harness, done} = browse(list);
        await harness.press("addons-navigate", {values: ["Gamma"]});

        const options = menu(harness.shown.at(-1) ?? {}).options ?? [];
        expect(options.map(option => option.default)).toEqual([false, false, true]);
        expect(JSON.stringify(harness.shown.at(-1))).toContain("# Gamma v1.2.3");

        await harness.end();
        await done;
    });

    // The previous version did `addons.find(...)!` and would have thrown.
    test("an unknown value leaves the selection alone", async () => {
        const {harness, done} = browse(list);
        await harness.press("addons-navigate", {values: ["NoSuchAddon"]});
        const options = menu(harness.shown.at(-1) ?? {}).options ?? [];
        expect(options.map(option => option.default)).toEqual([true, false, false]);
        await harness.end();
        await done;
    });
});


describe("list rendering", () => {
    test("separates entries but does not trail one", () => {
        const [, page] = createAddonList("Plugins", [addon({name: "A"}), addon({name: "B"})]);
        const types = (page.components as Array<{type: number}>).map(component => component.type);
        expect(types).toEqual([9, 14, 9]);
    });

    test("a single entry gets no separator", () => {
        const [, page] = createAddonList("Plugins", [addon()]);
        expect(page.components).toHaveLength(1);
    });

    test("the heading is a separate top-level text display", () => {
        const [heading] = createAddonList("Plugins sorted by downloads", [addon()]);
        expect(heading.content).toBe("## Plugins sorted by downloads");
    });
});


describe("sorting", () => {
    test("orders by the numeric field, descending", () => {
        const list = [addon({name: "a", likes: 1}), addon({name: "b", likes: 9}), addon({name: "c", likes: 5})];
        expect(sortAddons(list, "likes").map(a => a.name)).toEqual(["b", "c", "a"]);
    });

    test("orders by date, newest first", () => {
        const list = [
            addon({name: "old", latest_release_date: new Date("2020-01-01T00:00:00Z")}),
            addon({name: "new", latest_release_date: new Date("2024-01-01T00:00:00Z")})
        ];
        expect(sortAddons(list, "latest_release_date").map(a => a.name)).toEqual(["new", "old"]);
    });
});


describe("addon page", () => {
    test("adds a support-server button only when the author has a guild", () => {
        const withoutGuild = createAddonComponent(addon());
        const withGuild = createAddonComponent(addon({
            author: {...addon().author, guild: {name: "G", snowflake: "1", invite_link: "https://discord.gg/abc"}}
        }));
        const labels = (page: {components: readonly unknown[]}) =>
            JSON.stringify(page.components).match(/"label":"[^"]+"/g) ?? [];
        expect(labels(withoutGuild)).toHaveLength(2);
        expect(labels(withGuild)).toHaveLength(3);
    });

    test("falls back when an addon has no description", () => {
        const page = createAddonComponent(addon({description: undefined as unknown as string}));
        expect(JSON.stringify(page)).toContain("No description provided.");
    });
});

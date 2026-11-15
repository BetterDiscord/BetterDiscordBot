import {beforeEach, describe, expect, test} from "bun:test";
import {Dispatcher} from "../src/framework/dispatch";
import {defineCommand, defineComponent} from "../src/framework/registry";
import {Num, oneOf} from "../src/framework/ids";
import {sessionId} from "../src/framework/session";
import {lastReply, silenceConsole, stubInteraction} from "./helpers/interactions";


const calls: string[] = [];

const picker = defineComponent({
    id: "demo.pick",
    kind: "button",
    guildOnly: true,
    params: {mode: oneOf("user", "admin"), page: Num},
    run: (_interaction, {mode, page}) => {calls.push(`pick:${mode}:${page}`); return Promise.resolve();}
});

const anywhere = defineComponent({
    id: "demo.any",
    kind: "button",
    params: {},
    run: () => {calls.push("any"); return Promise.resolve();}
});

const guildCommand = defineCommand({
    guildOnly: true,
    data: {name: "demo", description: "d"},
    execute: () => {calls.push("demo"); return Promise.resolve();},
    autocomplete: () => {calls.push("demo:auto"); return Promise.resolve();}
});

const ownerCommand = defineCommand({
    ownerOnly: true,
    data: {name: "secret", description: "d"},
    execute: () => {calls.push("secret"); return Promise.resolve();}
});


function build() {
    const dispatcher = new Dispatcher({ownerId: "owner-1"});
    dispatcher.addCommand(guildCommand);
    dispatcher.addCommand(ownerCommand);
    dispatcher.addComponent(picker);
    dispatcher.addComponent(anywhere);
    return dispatcher;
}

beforeEach(() => {calls.length = 0;});


describe("command routing", () => {
    test("runs a registered command", async () => {
        await build().dispatch(stubInteraction({kind: "chat", commandName: "demo"}).interaction);
        expect(calls).toEqual(["demo"]);
    });

    test("guildOnly is enforced before the handler runs", async () => {
        const stub = stubInteraction({kind: "chat", commandName: "demo", cached: false});
        await build().dispatch(stub.interaction);
        expect(calls).toEqual([]);
        expect(lastReply(stub)).toContain("can't use that command here");
    });

    test("ownerOnly is enforced before the handler runs", async () => {
        const stub = stubInteraction({kind: "chat", commandName: "secret", userId: "someone-else"});
        await build().dispatch(stub.interaction);
        expect(calls).toEqual([]);

        const owner = stubInteraction({kind: "chat", commandName: "secret", userId: "owner-1"});
        await build().dispatch(owner.interaction);
        expect(calls).toEqual(["secret"]);
    });

    test("an unregistered command says so rather than failing silently", async () => {
        const restore = silenceConsole();
        const stub = stubInteraction({kind: "chat", commandName: "ghost"});
        await build().dispatch(stub.interaction);
        restore();
        expect(lastReply(stub)).toContain("isn't registered");
    });

    test("onCommandRun fires for stats, once per command", async () => {
        const seen: string[] = [];
        const dispatcher = new Dispatcher({ownerId: "owner-1", onCommandRun: i => {seen.push(i.commandName); return Promise.resolve();}});
        dispatcher.addCommand(guildCommand);
        await dispatcher.dispatch(stubInteraction({kind: "chat", commandName: "demo"}).interaction);
        expect(seen).toEqual(["demo"]);
    });
});


describe("autocomplete routing", () => {
    test("reaches the command's autocomplete handler", async () => {
        await build().dispatch(stubInteraction({kind: "autocomplete", commandName: "demo"}).interaction);
        expect(calls).toEqual(["demo:auto"]);
    });

    test("responds empty rather than throwing when there is no handler", async () => {
        const stub = stubInteraction({kind: "autocomplete", commandName: "secret"});
        await build().dispatch(stub.interaction);
        expect(stub.autocompleteResponses).toEqual([[]]);
    });
});


describe("component routing", () => {
    test("decodes params and passes them typed", async () => {
        await build().dispatch(stubInteraction({kind: "button", customId: picker.customId({mode: "admin", page: 7})}).interaction);
        expect(calls).toEqual(["pick:admin:7"]);
    });

    test("guildOnly components are gated too", async () => {
        const stub = stubInteraction({kind: "button", customId: picker.customId({mode: "user", page: 1}), cached: false});
        await build().dispatch(stub.interaction);
        expect(calls).toEqual([]);
        expect(lastReply(stub)).toContain("can't use that");
    });

    test("a component registered for one kind refuses another", async () => {
        const restore = silenceConsole();
        await build().dispatch(stubInteraction({kind: "stringSelect", customId: anywhere.customId({})}).interaction);
        restore();
        expect(calls).toEqual([]);
    });

    test("a stale id from before a deploy explains itself", async () => {
        const restore = silenceConsole();
        const stub = stubInteraction({kind: "button", customId: "demo.pick:admin"});
        await build().dispatch(stub.interaction);
        restore();
        expect(calls).toEqual([]);
        expect(lastReply(stub)).toContain("out of date");
    });

    test("a malformed param value explains itself the same way", async () => {
        const restore = silenceConsole();
        const stub = stubInteraction({kind: "button", customId: "demo.pick:sudo:1"});
        await build().dispatch(stub.interaction);
        restore();
        expect(lastReply(stub)).toContain("out of date");
    });

    // This silence is the contract that lets sessions and registered
    // components share one custom-id space.
    test("session-owned ids are left to their own collector", async () => {
        const stub = stubInteraction({kind: "button", customId: sessionId("next")});
        await build().dispatch(stub.interaction);
        expect(calls).toEqual([]);
        expect(stub.replies).toEqual([]);
    });

    test("an unknown namespace is ignored, not treated as an error", async () => {
        const stub = stubInteraction({kind: "button", customId: "nobody.knows:1"});
        await build().dispatch(stub.interaction);
        expect(stub.replies).toEqual([]);
    });

    // The pre-framework router matched on customId.split("-")[0].
    test("hyphenated ids no longer route anywhere", async () => {
        const stub = stubInteraction({kind: "roleSelect", customId: "cleanname-whatever"});
        await build().dispatch(stub.interaction);
        expect(calls).toEqual([]);
        expect(stub.replies).toEqual([]);
    });
});


describe("registration and failure", () => {
    test("duplicate command names throw at startup", () => {
        const dispatcher = build();
        expect(() => dispatcher.addCommand(guildCommand)).toThrow(/duplicate command/);
    });

    test("duplicate component namespaces throw at startup", () => {
        const dispatcher = build();
        expect(() => dispatcher.addComponent(picker)).toThrow(/duplicate component/);
    });

    test("a throwing handler is reported to the user, not swallowed", async () => {
        const restore = silenceConsole();
        const dispatcher = new Dispatcher({ownerId: "owner-1"});
        dispatcher.addCommand(defineCommand({
            data: {name: "boom", description: "d"},
            execute: () => {throw new Error("kaboom");}
        }));
        const stub = stubInteraction({kind: "chat", commandName: "boom"});
        await dispatcher.dispatch(stub.interaction);
        restore();
        expect(lastReply(stub)).toContain("Something went wrong");
    });

    test("counts report what is registered", () => {
        expect(build().counts).toEqual({commands: 2, components: 2});
    });
});

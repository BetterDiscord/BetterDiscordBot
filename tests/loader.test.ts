import path from "node:path";
import {describe, expect, test} from "bun:test";
import {Dispatcher, loadCommands, loadEvents} from "../src/framework";


const root = path.join(import.meta.dir, "..");
const fixtures = path.join(import.meta.dir, "fixtures");


describe("loading the real bot", () => {
    test("every command file exports a usable command", async () => {
        const commands = await loadCommands(path.join(root, "src", "commands"));
        expect(commands.length).toBeGreaterThan(0);
        for (const command of commands) {
            expect(typeof command.name).toBe("string");
            expect(command.data.name).toBe(command.name);
        }
    });

    test("command names are unique and API-legal", async () => {
        const commands = await loadCommands(path.join(root, "src", "commands"));
        const names = commands.map(command => command.name);
        expect(new Set(names).size).toBe(names.length);
        for (const name of names) expect(name).toMatch(/^[-_'\p{L}\p{N}]{1,32}$/u);
    });

    test("descriptions stay inside Discord's limits", async () => {
        for (const command of await loadCommands(path.join(root, "src", "commands"))) {
            expect(command.data.description.length).toBeGreaterThan(0);
            expect(command.data.description.length).toBeLessThanOrEqual(100);
        }
    });

    test("everything registers without a duplicate name or namespace", async () => {
        const dispatcher = new Dispatcher({ownerId: "owner"});
        const commands = await loadCommands(path.join(root, "src", "commands"));
        for (const command of commands) command.register(dispatcher);
        expect(dispatcher.counts.commands).toBe(commands.length);
    });

    test("every event file yields listeners with a name and an execute", async () => {
        const events = await loadEvents(path.join(root, "src", "events"));
        expect(events.length).toBeGreaterThan(0);
        for (const event of events) {
            expect(typeof event.name).toBe("string");
            expect(typeof event.execute).toBe("function");
        }
    });
});


describe("loader contract", () => {
    test("a file may export several listeners", async () => {
        const events = await loadEvents(path.join(fixtures, "events"));
        expect(events.map(event => event.name).sort()).toEqual(["guildMemberAdd", "guildMemberRemove", "messageCreate"]);
    });

    test("a command module with no exported command throws, naming the file", () => {
        expect(loadCommands(path.join(fixtures, "broken"))).rejects.toThrow(/nocommand\.ts/);
    });
});

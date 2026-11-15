import path from "node:path";
import {describe, expect, test} from "bun:test";
import {loadCommands} from "../src/framework";
import expected from "./fixtures/command-payloads.json";


/**
 * A snapshot of exactly what gets deployed to Discord.
 *
 * Refactors are supposed to leave this untouched; when one legitimately
 * changes a command, the diff here is the review. Regenerate with:
 *
 *     bun run tests/fixtures/regenerate-payloads.ts
 */

const sortKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        return Object.fromEntries(Object.keys(record).sort().map(key => [key, sortKeys(record[key])]));
    }
    return value;
};

async function currentPayloads(): Promise<Record<string, unknown>> {
    const payloads: Record<string, unknown> = {};
    for (const command of await loadCommands(path.join(import.meta.dir, "..", "src", "commands"))) {
        const data: unknown = JSON.parse(JSON.stringify(command.data));
        payloads[command.name] = sortKeys({data, ownerOnly: command.ownerOnly});
    }
    return payloads;
}


describe("deployed command payloads", () => {
    test("match the committed snapshot", async () => {
        expect(await currentPayloads()).toEqual(expected as Record<string, unknown>);
    });

    test("the snapshot covers every command that loads", async () => {
        expect(Object.keys(await currentPayloads()).sort()).toEqual(Object.keys(expected).sort());
    });
});


describe("payload invariants", () => {
    test("owner-only commands are deployed to the guild, not globally", async () => {
        const commands = await loadCommands(path.join(import.meta.dir, "..", "src", "commands"));
        expect(commands.filter(command => command.ownerOnly).map(command => command.name)).toEqual(["botadmin"]);
    });

    test("no command still uses the deprecated dm_permission field", async () => {
        for (const command of await loadCommands(path.join(import.meta.dir, "..", "src", "commands"))) {
            expect(command.data).not.toHaveProperty("dm_permission");
        }
    });

    test("subcommand options come last, as the API requires", async () => {
        for (const command of await loadCommands(path.join(import.meta.dir, "..", "src", "commands"))) {
            for (const option of command.data.options ?? []) {
                const nested = (option as {options?: Array<{required?: boolean}>}).options ?? [];
                const firstOptional = nested.findIndex(child => child.required !== true);
                if (firstOptional === -1) continue;
                expect(nested.slice(firstOptional).every(child => child.required !== true)).toBe(true);
            }
        }
    });
});

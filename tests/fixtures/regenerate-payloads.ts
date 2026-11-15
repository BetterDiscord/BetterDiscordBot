/**
 * Rewrites tests/fixtures/command-payloads.json from the current source.
 * Run this when a command change is intended, and review the resulting diff.
 */

import path from "node:path";
import {loadCommands} from "../../src/framework";

const sortKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        return Object.fromEntries(Object.keys(record).sort().map(key => [key, sortKeys(record[key])]));
    }
    return value;
};

const payloads: Record<string, unknown> = {};
for (const command of await loadCommands(path.join(import.meta.dir, "..", "..", "src", "commands"))) {
    const data: unknown = JSON.parse(JSON.stringify(command.data));
    payloads[command.name] = sortKeys({data, ownerOnly: command.ownerOnly});
}

const target = path.join(import.meta.dir, "command-payloads.json");
await Bun.write(target, JSON.stringify(payloads, null, 2) + "\n");
console.log(`Wrote ${Object.keys(payloads).length} command payloads to ${path.relative(process.cwd(), target)}`);

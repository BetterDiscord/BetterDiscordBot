/**
 * Module loading, with validation.
 *
 * The old loader cast the result of a dynamic `import()` straight to
 * `CommandModule`, so a malformed module became a runtime mystery instead of a
 * startup error. `events/joinleave.ts` exports an array of two listeners, which
 * that cast turned into `client.on(undefined, …)` — a feature that has never
 * fired. Everything here is checked, and a bad module fails loudly at boot.
 */

import fs from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
import type {RESTPostAPIChatInputApplicationCommandsJSONBody} from "discord.js";
import type {Dispatcher, LegacyEntry, LegacyKind} from "./dispatch";
import type {Command, Component, EventDef} from "./registry";


const LEGACY_KINDS: LegacyKind[] = ["execute", "autocomplete", "button", "modal", "select", "role"];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isFn = (value: unknown): value is (...args: never[]) => Promise<unknown> => typeof value === "function";


export interface LoadedCommand {
    name: string;
    /** Ready to send to the API, whichever style the module was written in. */
    data: RESTPostAPIChatInputApplicationCommandsJSONBody;
    ownerOnly: boolean;
    migrated: boolean;
    register(dispatcher: Dispatcher): void;
}


function sourceFiles(directory: string): string[] {
    return fs.readdirSync(directory)
        .filter(file => file.endsWith(".ts") || file.endsWith(".tsx"))
        .map(file => path.join(directory, file));
}

async function importModule(file: string): Promise<Record<string, unknown>> {
    const imported: unknown = await import(pathToFileURL(file).href);
    if (!isRecord(imported)) throw new Error(`${path.basename(file)} did not export a module object`);
    return imported;
}


/** Reads `data` off either style, normalising a builder to plain JSON. */
function commandData(source: unknown, file: string): RESTPostAPIChatInputApplicationCommandsJSONBody {
    if (!isRecord(source)) throw new Error(`${path.basename(file)}: command has no data`);

    const data: unknown = "toJSON" in source && typeof source.toJSON === "function"
        ? (source as {toJSON(): unknown;}).toJSON()
        : source;

    if (!isRecord(data) || typeof data.name !== "string") {
        throw new Error(`${path.basename(file)}: command data has no name`);
    }
    return data as unknown as RESTPostAPIChatInputApplicationCommandsJSONBody;
}


export async function loadCommands(directory: string): Promise<LoadedCommand[]> {
    const loaded: LoadedCommand[] = [];

    for (const file of sourceFiles(directory)) {
        const module = await importModule(file);

        // Migrated: `export const command = defineCommand(...)`, plus an optional
        // `export const components = [...]`.
        if (isRecord(module.command)) {
            const command = module.command as unknown as Command;
            if (!isFn(command.execute)) throw new Error(`${path.basename(file)}: exported command has no execute()`);

            const components = Array.isArray(module.components) ? module.components as Component[] : [];
            const data = commandData(command.data, file);

            loaded.push({
                name: data.name,
                data,
                ownerOnly: command.ownerOnly === true,
                migrated: true,
                register(dispatcher) {
                    dispatcher.addCommand(command);
                    for (const component of components) dispatcher.addComponent(component);
                }
            });
            continue;
        }

        // Not yet migrated: `export default {data, execute, button, ...}`.
        const legacyModule = isRecord(module.default) ? module.default : module;
        if (!isFn(legacyModule.execute)) throw new Error(`${path.basename(file)}: no exported command (expected \`export const command\` or a default export with execute())`);

        const data = commandData(legacyModule.data, file);
        const handlers: LegacyEntry["handlers"] = {};
        for (const kind of LEGACY_KINDS) {
            const handler = legacyModule[kind];
            if (isFn(handler)) handlers[kind] = handler.bind(legacyModule) as LegacyEntry["handlers"][LegacyKind];
        }

        const entry: LegacyEntry = {name: data.name, ownerOnly: legacyModule.owner === true, handlers};
        loaded.push({
            name: data.name,
            data,
            ownerOnly: entry.ownerOnly,
            migrated: false,
            register(dispatcher) {dispatcher.addLegacyCommand(entry);}
        });
    }

    return loaded.sort((a, b) => a.name.localeCompare(b.name));
}


/** Accepts one listener or an array of them from a single file. */
export async function loadEvents(directory: string): Promise<EventDef[]> {
    const events: EventDef[] = [];

    for (const file of sourceFiles(directory)) {
        const module = await importModule(file);
        const exported: unknown = module.default ?? module.event ?? module.events;
        const candidates: unknown[] = Array.isArray(exported) ? exported : [exported];

        for (const candidate of candidates) {
            if (!isRecord(candidate) || typeof candidate.name !== "string" || !isFn(candidate.execute)) {
                throw new Error(`${path.basename(file)}: exported an event without a name and execute()`);
            }
            events.push(candidate as unknown as EventDef);
        }
    }

    return events;
}

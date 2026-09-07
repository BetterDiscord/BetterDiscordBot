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
import type {Dispatcher} from "./dispatch";
import type {Command, Component, EventDef} from "./registry";


const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isFn = (value: unknown): value is (...args: never[]) => Promise<unknown> => typeof value === "function";


export interface LoadedCommand {
    name: string;
    data: RESTPostAPIChatInputApplicationCommandsJSONBody;
    ownerOnly: boolean;
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


function commandData(source: unknown, file: string): RESTPostAPIChatInputApplicationCommandsJSONBody {
    if (!isRecord(source) || typeof source.name !== "string") {
        throw new Error(`${path.basename(file)}: command data has no name`);
    }
    return source as unknown as RESTPostAPIChatInputApplicationCommandsJSONBody;
}


export async function loadCommands(directory: string): Promise<LoadedCommand[]> {
    const loaded: LoadedCommand[] = [];

    for (const file of sourceFiles(directory)) {
        const module = await importModule(file);

        if (!isRecord(module.command)) {
            throw new Error(`${path.basename(file)}: no exported command (expected \`export const command = defineCommand({...})\`)`);
        }

        const command = module.command as unknown as Command;
        if (typeof command.execute !== "function") throw new Error(`${path.basename(file)}: exported command has no execute()`);

        const components = Array.isArray(module.components) ? module.components as Component[] : [];
        const data = commandData(command.data, file);

        loaded.push({
            name: data.name,
            data,
            ownerOnly: command.ownerOnly === true,
            register(dispatcher) {
                dispatcher.addCommand(command);
                for (const component of components) dispatcher.addComponent(component);
            }
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

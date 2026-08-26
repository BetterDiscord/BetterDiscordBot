/**
 * Minimal stand-ins for discord.js interactions.
 *
 * The dispatcher only ever calls the type guards and a handful of reply
 * methods, so a plain object is enough and keeps the tests free of network or
 * gateway setup. The single cast is confined to this file.
 */

import type {Interaction} from "discord.js";


export type StubKind = "chat" | "autocomplete" | "button" | "stringSelect" | "roleSelect" | "modal";

export interface StubOptions {
    kind: StubKind;
    customId?: string;
    commandName?: string;
    userId?: string;
    /** false simulates a DM or an uncached guild. */
    cached?: boolean;
    values?: string[];
    deferred?: boolean;
    replied?: boolean;
}

export interface Stub {
    interaction: Interaction;
    /** Everything the code under test sent back, in order. */
    replies: Array<Record<string, unknown>>;
    updates: Array<Record<string, unknown>>;
    autocompleteResponses: unknown[][];
}


export function stubInteraction(options: StubOptions): Stub {
    const {kind, customId = "", commandName = "", userId = "user-1", cached = true, values = []} = options;

    const replies: Array<Record<string, unknown>> = [];
    const updates: Array<Record<string, unknown>> = [];
    const autocompleteResponses: unknown[][] = [];

    const interaction = {
        customId,
        commandName,
        values,
        user: {id: userId},
        deferred: options.deferred ?? false,
        replied: options.replied ?? false,

        isChatInputCommand: () => kind === "chat",
        isAutocomplete: () => kind === "autocomplete",
        isMessageComponent: () => kind === "button" || kind === "stringSelect" || kind === "roleSelect",
        isModalSubmit: () => kind === "modal",
        isButton: () => kind === "button",
        isStringSelectMenu: () => kind === "stringSelect",
        isRoleSelectMenu: () => kind === "roleSelect",
        isUserSelectMenu: () => false,
        isChannelSelectMenu: () => false,
        isMentionableSelectMenu: () => false,
        isRepliable: () => true,
        inCachedGuild: () => cached,

        reply: (payload: Record<string, unknown>) => {replies.push(payload); return Promise.resolve();},
        followUp: (payload: Record<string, unknown>) => {replies.push(payload); return Promise.resolve();},
        update: (payload: Record<string, unknown>) => {updates.push(payload); return Promise.resolve();},
        deferUpdate: () => Promise.resolve(),
        respond: (choices: unknown[]) => {autocompleteResponses.push(choices); return Promise.resolve();}
    };

    return {interaction: interaction as unknown as Interaction, replies, updates, autocompleteResponses};
}

/** Text of the last thing sent back, for terse assertions. */
export function lastReply(stub: Stub): string {
    const content = stub.replies.at(-1)?.content;
    return typeof content === "string" ? content : "";
}


/**
 * Silences console output for one test. Several dispatcher paths log on
 * purpose (a stale id, an unregistered command, a handler that threw); this
 * keeps the suite output clean so a real failure stands out, and marks those
 * tests as expecting the noise.
 */
export function silenceConsole(): () => void {
    const {error, warn} = console;
    console.error = () => {};
    console.warn = () => {};
    return () => {console.error = error; console.warn = warn;};
}

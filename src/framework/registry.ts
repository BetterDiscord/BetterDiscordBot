/**
 * Command, component and event definitions.
 *
 * Two rules this file exists to enforce:
 *
 *  1. A handler's interaction type is fixed by the definition, not chosen by the
 *     caller. The old `CommandModule` used `<T extends BaseInteraction = ...>`,
 *     which puts T under the caller's control and makes every implementation's
 *     narrowing unchecked.
 *  2. `guildOnly` is a claim the dispatcher enforces before calling you, not an
 *     `as` cast you assert afterwards.
 */

import type {
    AutocompleteInteraction, ButtonInteraction, CacheType, ChannelSelectMenuInteraction,
    ChatInputCommandInteraction, ClientEvents, MentionableSelectMenuInteraction,
    ModalSubmitInteraction, RESTPostAPIChatInputApplicationCommandsJSONBody,
    RoleSelectMenuInteraction, StringSelectMenuInteraction, UserSelectMenuInteraction
} from "discord.js";
import {decodeId, encodeId, type ParamSpec, type Params} from "./ids";


/** `true` gives handlers `<"cached">` interactions. */
export type Cache<G extends boolean> = G extends true ? "cached" : CacheType;


/* -------------------------------------------------------------------- commands */

export interface Command<G extends boolean = boolean> {
    data: RESTPostAPIChatInputApplicationCommandsJSONBody;
    /** Dispatcher rejects the interaction unless it is in a cached guild. */
    guildOnly?: G;
    /** Dispatcher rejects the interaction unless the user is BOT_OWNER_ID. */
    ownerOnly?: boolean;
    execute(interaction: ChatInputCommandInteraction<Cache<G>>): Promise<unknown>;
    autocomplete?(interaction: AutocompleteInteraction<Cache<G>>): Promise<unknown>;
}

export function defineCommand<const G extends boolean = false>(command: Command<G>): Command<G> {
    return command;
}


/* ------------------------------------------------------------------ components */

export interface ComponentInteractions<G extends boolean> {
    button: ButtonInteraction<Cache<G>>;
    stringSelect: StringSelectMenuInteraction<Cache<G>>;
    roleSelect: RoleSelectMenuInteraction<Cache<G>>;
    userSelect: UserSelectMenuInteraction<Cache<G>>;
    channelSelect: ChannelSelectMenuInteraction<Cache<G>>;
    mentionableSelect: MentionableSelectMenuInteraction<Cache<G>>;
    modal: ModalSubmitInteraction<Cache<G>>;
}

export type ComponentKind = keyof ComponentInteractions<boolean>;

export interface ComponentDef<K extends ComponentKind, S extends ParamSpec, G extends boolean> {
    /** Unique namespace, and the prefix of every custom id it mints. */
    id: string;
    kind: K;
    params: S;
    guildOnly?: G;
    ownerOnly?: boolean;
    run(interaction: ComponentInteractions<G>[K], params: Params<S>): Promise<unknown>;
}

/** A registered definition: a handler and a type-checked id minter. */
export interface Component<K extends ComponentKind = ComponentKind, S extends ParamSpec = ParamSpec, G extends boolean = boolean> extends ComponentDef<K, S, G> {
    customId(params: Params<S>): string;
    decode(raw: string): Params<S>;
}

export function defineComponent<const K extends ComponentKind, const S extends ParamSpec, const G extends boolean = false>(definition: ComponentDef<K, S, G>): Component<K, S, G> {
    return {
        ...definition,
        customId: params => encodeId(definition.id, definition.params, params),
        decode: raw => decodeId(definition.params, raw)
    };
}


/* ---------------------------------------------------------------------- events */

export interface EventDef<E extends keyof ClientEvents = keyof ClientEvents> {
    name: E;
    once?: boolean;
    execute(...args: ClientEvents[E]): Promise<unknown>;
}

export function defineEvent<const E extends keyof ClientEvents>(event: EventDef<E>): EventDef<E> {
    return event;
}

/**
 * For files that register more than one listener. The loader accepts an array
 * from any event file, which is what `events/joinleave.ts` already assumed.
 */
export function defineEvents(...events: EventDef[]): EventDef[] {
    return events;
}

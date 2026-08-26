/**
 * The one place a raw Interaction becomes a typed handler call.
 *
 * Every unsafe narrowing in the app lives here, each on the line after the
 * runtime check that justifies it. That is the point: not zero unsafety, but
 * unsafety that is located, guarded and auditable.
 *
 * The `legacy` half supports command modules that have not been migrated to
 * `defineCommand` yet, and should be deleted once they all have.
 */

import {
    type ChatInputCommandInteraction, type Interaction, MessageFlags, type RepliableInteraction
} from "discord.js";
import {IdError, namespaceOf} from "./ids";
import type {Command, Component, ComponentKind} from "./registry";
import {isSessionId} from "./session";


type CommandHandler = (interaction: never) => Promise<unknown>;
type ComponentHandler = (interaction: never, params: never) => Promise<unknown>;

const KIND_GUARD: {[K in ComponentKind]: (interaction: Interaction) => boolean} = {
    button: interaction => interaction.isButton(),
    stringSelect: interaction => interaction.isStringSelectMenu(),
    roleSelect: interaction => interaction.isRoleSelectMenu(),
    userSelect: interaction => interaction.isUserSelectMenu(),
    channelSelect: interaction => interaction.isChannelSelectMenu(),
    mentionableSelect: interaction => interaction.isMentionableSelectMenu(),
    modal: interaction => interaction.isModalSubmit()
};


/** @deprecated Shape of a not-yet-migrated command module. */
export type LegacyKind = "execute" | "autocomplete" | "button" | "modal" | "select" | "role";

/** @deprecated Remove once every command uses `defineCommand`. */
export interface LegacyEntry {
    name: string;
    ownerOnly: boolean;
    handlers: Partial<Record<LegacyKind, CommandHandler>>;
}


export interface DispatcherOptions {
    ownerId: string;
    /** Called before a chat-input command runs. Used for command stats. */
    onCommandRun?(interaction: ChatInputCommandInteraction): Promise<unknown>;
}


export class Dispatcher {
    private commands = new Map<string, Command>();
    private components = new Map<string, Component>();
    private legacy = new Map<string, LegacyEntry>();
    private options: DispatcherOptions;

    constructor(options: DispatcherOptions) {
        this.options = options;
    }

    addCommand(command: Command): void {
        const name = command.data.name;
        if (this.commands.has(name) || this.legacy.has(name)) throw new Error(`duplicate command "${name}"`);
        this.commands.set(name, command);
    }

    addComponent(component: Component): void {
        if (this.components.has(component.id)) throw new Error(`duplicate component namespace "${component.id}"`);
        this.components.set(component.id, component);
    }

    /** @deprecated */
    addLegacyCommand(entry: LegacyEntry): void {
        if (this.commands.has(entry.name) || this.legacy.has(entry.name)) throw new Error(`duplicate command "${entry.name}"`);
        this.legacy.set(entry.name, entry);
    }

    get counts(): {commands: number; legacy: number; components: number;} {
        return {commands: this.commands.size, legacy: this.legacy.size, components: this.components.size};
    }


    async dispatch(interaction: Interaction): Promise<void> {
        try {
            if (interaction.isChatInputCommand()) return await this.runCommand(interaction);
            if (interaction.isAutocomplete()) return await this.runAutocomplete(interaction);
            if (interaction.isMessageComponent() || interaction.isModalSubmit()) return await this.runComponent(interaction);
        }
        catch (error) {
            await this.reportFailure(interaction, error);
        }
    }


    private async runCommand(interaction: ChatInputCommandInteraction): Promise<void> {
        const command = this.commands.get(interaction.commandName);
        const legacy = this.legacy.get(interaction.commandName);
        if (!command && !legacy) {
            console.error("unregistered command", interaction.commandName);
            return await this.reply(interaction, "That command isn't registered any more.");
        }

        await this.options.onCommandRun?.(interaction);

        if (legacy) {
            if (legacy.ownerOnly && interaction.user.id !== this.options.ownerId) return await this.reply(interaction, "That command is owner-only.");
            return void await legacy.handlers.execute?.(interaction as never);
        }

        if (!this.permitted(command!, interaction)) return await this.reply(interaction, "You can't use that command here.");

        // Guarded above: `guildOnly` was checked, so the `<"cached">` the handler
        // declares is actually true by this point.
        await (command!.execute as CommandHandler)(interaction as never);
    }


    private async runAutocomplete(interaction: Interaction): Promise<void> {
        if (!interaction.isAutocomplete()) return;

        const legacy = this.legacy.get(interaction.commandName);
        if (legacy) return void await legacy.handlers.autocomplete?.(interaction as never);

        const command = this.commands.get(interaction.commandName);
        if (!command?.autocomplete) return await interaction.respond([]);
        if (command.guildOnly && !interaction.inCachedGuild()) return await interaction.respond([]);

        await (command.autocomplete as CommandHandler)(interaction as never);
    }


    private async runComponent(interaction: Interaction): Promise<void> {
        if (!interaction.isMessageComponent() && !interaction.isModalSubmit()) return;

        // Session-owned. Its own collector handles it; this is the contract that
        // lets registered components and sessions share one custom-id space.
        if (isSessionId(interaction.customId)) return;

        const component = this.components.get(namespaceOf(interaction.customId));
        if (!component) return await this.runLegacyComponent(interaction);

        if (!KIND_GUARD[component.kind](interaction)) {
            console.warn(`component "${component.id}" is registered as ${component.kind} but received a ${interaction.isModalSubmit() ? "modal submit" : "component"} interaction`);
            return;
        }
        if (!this.permitted(component, interaction)) return await this.reply(interaction, "You can't use that.");

        let params;
        try {
            params = component.decode(interaction.customId);
        }
        catch (error) {
            // Almost always a message from before the last deploy.
            if (error instanceof IdError) {
                console.warn("stale custom id", interaction.customId, error.message);
                return await this.reply(interaction, "This message is out of date. Please run the command again.");
            }
            throw error;
        }

        await (component.run as ComponentHandler)(interaction as never, params as never);
    }


    /** @deprecated Routing by `customId.split("-")[0]`, kept for unmigrated commands. */
    private async runLegacyComponent(interaction: Interaction): Promise<void> {
        if (!interaction.isMessageComponent() && !interaction.isModalSubmit()) return;

        const entry = this.legacy.get(interaction.customId.split("-")[0]);
        if (!entry) return;

        let kind: LegacyKind | undefined;
        if (interaction.isButton()) kind = "button";
        else if (interaction.isModalSubmit()) kind = "modal";
        else if (interaction.isStringSelectMenu()) kind = "select";
        else if (interaction.isRoleSelectMenu()) kind = "role";
        if (!kind) return;

        if (entry.ownerOnly && interaction.user.id !== this.options.ownerId) return;
        await entry.handlers[kind]?.(interaction as never);
    }


    private permitted(definition: {guildOnly?: boolean; ownerOnly?: boolean;}, interaction: Interaction): boolean {
        if (definition.guildOnly && !interaction.inCachedGuild()) return false;
        if (definition.ownerOnly && interaction.user.id !== this.options.ownerId) return false;
        return true;
    }


    private async reply(interaction: Interaction, content: string): Promise<void> {
        if (!interaction.isRepliable()) return;
        await this.send(interaction, content);
    }


    private async send(interaction: RepliableInteraction, content: string): Promise<void> {
        const payload = {content, flags: MessageFlags.Ephemeral} as const;
        if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
        else await interaction.reply(payload);
    }


    private async reportFailure(interaction: Interaction, error: unknown): Promise<void> {
        console.error(error);
        if (!interaction.isRepliable()) return;
        try {
            await this.send(interaction, "Something went wrong running that. It has been logged.");
        }
        catch (replyError) {
            // The token may already be dead. The reporter must never throw.
            console.error("could not report failure to user", replyError);
        }
    }
}

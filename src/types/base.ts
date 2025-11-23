// src/types.ts
import {AutocompleteInteraction, BaseInteraction, ButtonInteraction, ChatInputCommandInteraction, Collection, ModalSubmitInteraction, RoleSelectMenuInteraction, SlashCommandBuilder, StringSelectMenuInteraction} from "discord.js";


// Extend the Discord.js Client interface globally
declare module "discord.js" {
    interface Client {
        cpuUsage: NodeJS.CpuUsage;
        commands: Collection<string, CommandModule>;
    }
}

export type AtLeast<T, K extends keyof T> = Partial<T> & Pick<T, K>;

export type CommandModule = {
    data: SlashCommandBuilder;
    owner?: boolean;
    execute: <T extends BaseInteraction = ChatInputCommandInteraction>(interaction: T) => Promise<void>;
    autocomplete: <T extends BaseInteraction = AutocompleteInteraction>(i: T) => unknown;
    button: <T extends BaseInteraction = ButtonInteraction>(i: T) => unknown;
    modal: <T extends BaseInteraction = ModalSubmitInteraction>(i: T) => unknown;
    select: <T extends BaseInteraction = StringSelectMenuInteraction>(i: T) => unknown;
    role: <T extends BaseInteraction = RoleSelectMenuInteraction>(i: T) => unknown;
};

export interface EventModule {
    name: string;
    once?: boolean;
    execute: (...args: unknown[]) => Promise<void>;
}

export interface CommandStats {
    commands?: {
        [key: string]: number;
    };
}

export interface GuildSettings {
    cleanOnJoin?: boolean;
    inviteChannel?: string;
    invitefilter?: boolean;
    detectspam?: boolean;
    modlog?: string;
    joinleave?: string;
}

export interface UserInstallNotice {
    lastNotified: number;
}

export interface Tag {
    name: string;
    title?: string;
    content: string;
    thumbnailUrl?: string;
}
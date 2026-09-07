// src/types.ts
import type {Dispatcher} from "../framework/dispatch";


// Extend the Discord.js Client interface globally
declare module "discord.js" {
    interface Client {
        cpuUsage: NodeJS.CpuUsage;
        dispatcher: Dispatcher;
    }
}

export type AtLeast<T, K extends keyof T> = Partial<T> & Pick<T, K>;

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
/**
 * Short status messages, as Components V2 containers.
 *
 * These replace the `<Success>` / `<Error>` / `<Info>` / `<Warn>` JSX widgets
 * from djsx and produce the same payload.
 *
 * NOTE: this is one of two message layers in the codebase right now. The other
 * is the embed-based `Messages` class in `./messages.ts`, which the unmigrated
 * commands still use. Collapsing them onto this one is the next pass.
 */

import {
    MessageFlags,
    type ActionRowData, type ComponentInContainerData, type MessageActionRowComponentData
} from "discord.js";
import {container, text, type ComponentMessage} from "../framework/ui";
import {Accents} from "./colors";


export type NoticeKind = "success" | "info" | "warn" | "error" | "danger";

export interface NoticeOptions {
    ephemeral?: boolean;
    /** Extra message flags to merge in. */
    flags?: number;
    /** Action rows rendered inside the container, below the text. */
    components?: Array<ActionRowData<MessageActionRowComponentData>>;
}

const ACCENTS: Record<NoticeKind, number> = {
    success: Accents.Success,
    info: Accents.Info,
    warn: Accents.Warn,
    error: Accents.Error,
    danger: Accents.Danger
};

const ICONS: Record<NoticeKind, string> = {
    success: ":white_check_mark:",
    info: ":information_source:",
    warn: ":warning:",
    error: ":no_entry:",
    danger: ":no_entry:"
};


export type Notice = ComponentMessage;

export function notice(kind: NoticeKind, content: string, options: NoticeOptions = {}): Notice {
    const body: ComponentInContainerData[] = [text(`${ICONS[kind]}   ${content}`)];
    if (options.components?.length) body.push(...options.components);

    return {
        flags: MessageFlags.IsComponentsV2 | (options.ephemeral ? MessageFlags.Ephemeral : 0) | (options.flags ?? 0),
        components: [container(body, {accentColor: ACCENTS[kind]})]
    };
}

export const success = (content: string, options?: NoticeOptions): Notice => notice("success", content, options);
export const info = (content: string, options?: NoticeOptions): Notice => notice("info", content, options);
export const warn = (content: string, options?: NoticeOptions): Notice => notice("warn", content, options);
export const error = (content: string, options?: NoticeOptions): Notice => notice("error", content, options);
export const danger = (content: string, options?: NoticeOptions): Notice => notice("danger", content, options);

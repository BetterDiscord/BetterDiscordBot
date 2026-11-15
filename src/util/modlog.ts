/**
 * Moderation log entries.
 *
 * detectspam, invitefilter and detectcryptoscam each built their own
 * near-identical embeds and each repeated the same channel-resolution dance.
 * One helper now covers both entry shapes and the lookup.
 */

import {ComponentType, MessageFlags, type ComponentInContainerData, type Guild, type TextDisplayComponentData} from "discord.js";
import {container, text, type ComponentMessage} from "../framework";
import {Accents} from "./colors";


export interface ModLogEntry {
    /** Heading line: the offending user, or the action taken. */
    heading: string;
    /** Avatar shown alongside the entry, as the embed author icon used to be. */
    iconUrl?: string;
    body: string;
    reason: string;
    userId: string;
    /** Milliseconds; rendered as Discord's own per-viewer localised timestamp. */
    at: number;
}


export function modLogMessage(entry: ModLogEntry): ComponentMessage {
    const lines: TextDisplayComponentData[] = [
        {type: ComponentType.TextDisplay, content: `### ${entry.heading}`},
        {type: ComponentType.TextDisplay, content: entry.body || "​"},
        {type: ComponentType.TextDisplay, content: `**Reason:** ${entry.reason}`}
    ];

    // A Section with a thumbnail is the closest V2 has to an embed author icon.
    const body: ComponentInContainerData[] = entry.iconUrl
        ? [{type: ComponentType.Section, components: lines, accessory: {type: ComponentType.Thumbnail, media: {url: entry.iconUrl}}}]
        : [...lines];

    body.push(text(`-# ID: ${entry.userId} • <t:${Math.floor(entry.at / 1000)}:f>`));

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container(body, {accentColor: Accents.Info})]
    };
}


/** Posts to the guild's configured modlog channel. Silently no-ops if unset. */
export async function sendModLog(guild: Guild, channelId: string | undefined, entry: ModLogEntry): Promise<void> {
    if (!channelId) return;
    const channel = guild.channels.cache.get(channelId);
    if (!channel?.isTextBased()) return;

    await channel.send(modLogMessage(entry));
}

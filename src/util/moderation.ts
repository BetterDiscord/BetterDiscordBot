import path from "node:path";
import {EmbedBuilder, PermissionFlagsBits, type GuildTextBasedChannel, type Message} from "discord.js";
import type {GuildSettings} from "../types";
import Colors from "./colors";
import type {FlaggedImage} from "./scamimages";


const ACCOUNT_ISSUES_CHANNEL_ID = "1465301762821853204";

/**
 * Whether the message filters should look at this message at all. They skip direct messages, the bot's own
 * messages, the bot owner, and anyone who can manage messages in the channel.
 */
export function isFilterable(message: Message): message is Message<true> {
    if (!message.inGuild() || message.author.id === process.env.BOT_OWNER_ID) return false;
    if (message.author.id === message.client.user.id) return false;
    if (message.channel.permissionsFor(message.author)?.has(PermissionFlagsBits.ManageMessages)) return false;
    return true;
}

/**
 * Deletes the message and returns whether it was deleted.
 * `filterName` only appears in the error that is logged when the delete fails.
 */
export async function deleteMessage(message: Message<true>, filterName: string): Promise<boolean> {
    try {
        await message.delete();
        return true;
    }
    catch {
        // TODO: logging?
        console.error(`Could not delete ${filterName} message. Likely permissions.`);
        return false;
    }
}

/**
 * Gives the author the guild's mute role, which is the first role with "mute" in its name.
 * Returns whether the role was added. It is not added when the guild has no such role, when the member
 * already has it, or when the bot lacks permission.
 */
export async function muteAuthor(message: Message<true>): Promise<boolean> {
    const muteRoleId = message.guild.roles.cache.findKey(r => r.name.toLowerCase().includes("mute"));
    if (!muteRoleId) return false;

    const member = message.guild.members.cache.get(message.author.id);
    if (!member || member.roles.cache.has(muteRoleId)) return false;

    try {
        await member.roles.add(muteRoleId);
        return true;
    }
    catch {
        // TODO: logging?
        console.error("Could not add mute role. Likely permissions.");
        return false;
    }
}

/** Times the author out. Returns whether the timeout was applied. */
export async function timeoutAuthor(message: Message<true>, duration: number, reason: string): Promise<boolean> {
    const member = message.guild.members.cache.get(message.author.id);
    if (!member) return false;

    try {
        await member.timeout(duration, reason);
        return true;
    }
    catch {
        // TODO: logging?
        console.error("Could not timeout member. Likely permissions.");
        return false;
    }
}

/** Tells the author, in the account issues channel, that their account may be compromised. */
export async function warnCompromisedAccount(message: Message<true>) {
    const channel = message.guild.channels.cache.get(ACCOUNT_ISSUES_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) return;
    await channel.send({content: `${message.author.toString()} (${message.author.id}) your account may be compromised! Change your password and remove any unfamiliar account connections and authorized apps.`});
}

/** The channel that moderation actions are logged to, if the guild has set one and it still exists. */
export function getModlogChannel(message: Message<true>, settings: GuildSettings): GuildTextBasedChannel | undefined {
    if (!settings.modlog) return undefined;
    const channel = message.guild.channels.cache.get(settings.modlog);
    return channel?.isTextBased() ? channel : undefined;
}

/** Logs the content of a message that a filter removed. */
export async function logRemovedMessage(modlog: GuildTextBasedChannel, message: Message<true>, reason: string) {
    const embed = new EmbedBuilder().setColor(Colors.Info)
        .setAuthor({name: message.author.username, iconURL: message.author.displayAvatarURL()})
        .setDescription(`Message sent by ${message.author.username} in ${message.channel.name}\n\n` + message.content)
        .addFields({name: "Reason", value: reason})
        .setFooter({text: `ID: ${message.author.id}`}).setTimestamp(message.createdTimestamp);
    await modlog.send({embeds: [embed]});
}

/** Logs an action taken against the author, such as "Member Muted". */
export async function logMemberAction(modlog: GuildTextBasedChannel, message: Message<true>, action: string, reason: string) {
    const embed = new EmbedBuilder().setColor(Colors.Info)
        .setAuthor({name: action, iconURL: message.author.displayAvatarURL()})
        .setDescription(`${message.author.displayName} ${message.author.tag}`)
        .addFields({name: "Reason", value: reason})
        .setFooter({text: `ID: ${message.author.id}`}).setTimestamp(message.createdTimestamp);
    await modlog.send({embeds: [embed]});
}

/**
 * Tells the author, in a direct message, why their message was removed and that their account may be compromised.
 * Returns whether the message was delivered, which it is not when the author has direct messages turned off.
 */
export async function notifyCompromisedAccount(message: Message<true>): Promise<boolean> {
    try {
        await message.author.send({content: `Your message in **${message.guild.name}** was removed because it contained an image that looks like a known crypto scam. Your account may be compromised! Change your password and remove any unfamiliar account connections and authorized apps.`});
        return true;
    }
    catch {
        return false;
    }
}

/** What happened when a filter tried to remove a message, time its author out and notify them */
export interface RemovalOutcome {
    wasDeleted: boolean;
    didTimeout: boolean;
    wasNotified: boolean;
}

/**
 * Logs an image that matched the crypto scam, with the image itself and the terms that were found in it.
 * `outcome` is left out when the guild only logs matches, so nothing was done to the message or its author.
 */
export async function logScamImage(modlog: GuildTextBasedChannel, message: Message<true>, image: FlaggedImage, outcome?: RemovalOutcome) {
    // A failed step is spelled out, because otherwise the only sign of it is in the bot's console
    const action = outcome
        ? [
            outcome.wasDeleted ? "Message removed" : "Message could not be removed",
            outcome.didTimeout ? "member timed out" : "member could not be timed out",
            outcome.wasNotified ? "member notified" : "member could not be notified",
        ].join(", ")
        : "None (log only)";
    const isMessageGone = outcome?.wasDeleted ?? false;

    // The log gets its own copy of the image, because the original disappears with the message
    const fileName = `flagged${path.extname(image.name) || ".png"}`;
    const embed = new EmbedBuilder().setColor(Colors.Info)
        .setAuthor({name: "Scam Image Detected", iconURL: message.author.displayAvatarURL()})
        .setDescription(`Image sent by ${message.author.username} in <#${message.channel.id}>` + (isMessageGone ? "" : `\n\n[Jump to message](${message.url})`))
        .addFields(
            {name: "Matched Terms", value: image.terms.join(", ")},
            {name: "Action", value: action},
        )
        .setImage(`attachment://${fileName}`)
        .setFooter({text: `ID: ${message.author.id}`}).setTimestamp(message.createdTimestamp);
    await modlog.send({embeds: [embed], files: [{attachment: image.contents, name: fileName}]});
}

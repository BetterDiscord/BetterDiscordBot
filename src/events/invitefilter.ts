import {Events, type Message} from "discord.js";
import {guildDB} from "../db";
import {deleteMessage, getModlogChannel, isFilterable, logMemberAction, logRemovedMessage, muteAuthor} from "../util/moderation";



const discordInviteRegex = new RegExp(`(?:https?:\\/\\/)?discord\\.gg\\/?([A-Z0-9]+)`, "ig");
const oldInviteRegex = new RegExp(`(?:https?:\\/\\/)?discordapp\\.com\\/invite\\/?([A-Z0-9]+)`, "ig");

// TODO: maybe make configurable?
const whitelist = ["0Tmfo5ZbORCRqbAd"];

export default {
    name: Events.MessageCreate,

    async execute(message: Message) {
        if (!isFilterable(message)) return;

        // Obviously if this is disabled we don't need to do this stuff either
        const current = await guildDB.get(message.guild.id) ?? {};
        if (!current?.invitefilter) return;

        const inviteMatches = [...message.content.matchAll(discordInviteRegex)];
        const oldInviteMatches = [...message.content.matchAll(oldInviteRegex)];
        if (!inviteMatches.length && !oldInviteMatches.length) return; // No invites found, bail

        const allGood = inviteMatches.every(i => whitelist.includes(i[1])) && oldInviteMatches.every(i => whitelist.includes(i[1]));
        if (allGood) return; // All matches were whitelisted

        await deleteMessage(message, "invite filter");
        const didMute = await muteAuthor(message);

        const modlog = getModlogChannel(message, current);
        if (!modlog) return; // Can't log

        await logRemovedMessage(modlog, message, "Discord Invite");
        if (didMute) await logMemberAction(modlog, message, "Member Muted", "Discord Invite");
    },
};

import {Events, PermissionFlagsBits, type Message} from "discord.js";
import {guildDB} from "../db";
import {sendModLog} from "../util/modlog";



const discordInviteRegex = new RegExp(`(?:https?:\\/\\/)?discord\\.gg\\/?([A-Z0-9]+)`, "ig");
const oldInviteRegex = new RegExp(`(?:https?:\\/\\/)?discordapp\\.com\\/invite\\/?([A-Z0-9]+)`, "ig");

// TODO: maybe make configurable?
const whitelist = ["0Tmfo5ZbORCRqbAd"];

export default {
    name: Events.MessageCreate,

    async execute(message: Message) {
        // Ignore DM messages and owner messages and people with manage messages perms
        if (!message.inGuild() || message.author.id === process.env.BOT_OWNER_ID) return;
        if (message.author.id === message.client.user.id) return;
        if (message.channel.permissionsFor(message.author)?.has(PermissionFlagsBits.ManageMessages)) return;

        // Obviously if this is disabled we don't need to do this stuff either
        const current = await guildDB.get(message.guild.id) ?? {};
        if (!current?.invitefilter) return;

        const inviteMatches = [...message.content.matchAll(discordInviteRegex)];
        const oldInviteMatches = [...message.content.matchAll(oldInviteRegex)];
        if (!inviteMatches.length && !oldInviteMatches.length) return; // No invites found, bail

        const allGood = inviteMatches.every(i => whitelist.includes(i[1])) && oldInviteMatches.every(i => whitelist.includes(i[1]));
        if (allGood) return; // All matches were whitelisted

        try {
            await message.delete();
        }
        catch {
            // TODO: logging?
            console.error("Could not delete invite filter message. Likely permissions.");
        }

        let didMute = false;
        const muteRoleId = message.guild.roles.cache.findKey(r => r.name.toLowerCase().includes("mute"));
        if (muteRoleId) {
            const member = message.guild.members.cache.get(message.author.id);
            if (member && !member.roles.cache.has(muteRoleId)) {
                try {
                    await member.roles.add(muteRoleId);
                    didMute = true;
                }
                catch {
                    // TODO: logging?
                    console.error("Could not add mute role. Likely permissions.");
                }
            }
        }

        const reason = "Discord Invite";
        await sendModLog(message.guild, current.modlog, {
            heading: message.author.username,
            iconUrl: message.author.displayAvatarURL(),
            body: `Message sent by ${message.author.username} in ${message.channel.name}\n\n${message.content}`,
            reason,
            userId: message.author.id,
            at: message.createdTimestamp
        });

        if (didMute) {
            await sendModLog(message.guild, current.modlog, {
                heading: "Member Muted",
                iconUrl: message.author.displayAvatarURL(),
                body: `${message.author.displayName} ${message.author.tag}`,
                reason,
                userId: message.author.id,
                at: message.createdTimestamp
            });
        }
    },
};
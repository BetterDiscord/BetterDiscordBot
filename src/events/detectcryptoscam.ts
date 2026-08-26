import {Events, Message, PermissionFlagsBits} from "discord.js";
import {guildDB} from "../db";
import {sendModLog} from "../util/modlog";


const TIMEOUT_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
const TARGET_GUILD_ID = "86004744966914048";
const ACCOUNT_ISSUES_CHANNEL_ID = "1465301762821853204";
const sketchyImageRegex = /https:\/\/(?:cdn|media)\.(?:discord|discordapp)\.(?:com|net)\/attachments\/\d+\/\d+\/(?:[1234]|image)\.(?:jpg|png|webp)(?:\?.*?)?(?:\s+|$)/;

// TODO: consider de-duping with invitefilter event
export default {
    name: Events.MessageCreate,

    async execute(message: Message) {
        // Ignore DM messages and owner messages and people with manage messages perms
        if (!message.inGuild() || message.author.id === process.env.BOT_OWNER_ID) return;
        if (message.author.id === message.client.user.id) return;
        if (message.guild.id !== TARGET_GUILD_ID) return;
        if (message.channel.permissionsFor(message.author)?.has(PermissionFlagsBits.ManageMessages)) return;

        // Obviously if this is disabled we don't need to do this stuff either
        const current = await guildDB.get(message.guild.id) ?? {};
        if (!current?.detectspam) return;

        // Current scam images always have 4 attachments, so if it's not 4 attachments it's not a scam image. Let's get out of here
        if (message.attachments.size !== 4) return;

        const allSketchy = message.attachments.every(a => sketchyImageRegex.test(a.url));
        if (!allSketchy) return; // Not spam, let's get out of here

        try {
            await message.delete();
        }
        catch {
            // TODO: logging?
            console.error("Could not delete detect spam message. Likely permissions.");
        }

        let didTimeout = false;
        const member = message.guild.members.cache.get(message.author.id);
        try {
            await member?.timeout(TIMEOUT_DURATION, "Detected Crypto Scam");
            didTimeout = true;
        }
        catch {
            // TODO: logging?
            console.error("Could not timeout member. Likely permissions.");
        }

        const accountIssuesChannel = message.guild.channels.cache.get(ACCOUNT_ISSUES_CHANNEL_ID);
        if (accountIssuesChannel && accountIssuesChannel.isTextBased()) {
            await accountIssuesChannel.send({content: `${message.author.toString()} (${message.author.id}) your account may be compromised! Change your password and remove any unfamiliar account connections and authorized apps.`});
        }


        if (didTimeout) {
            await sendModLog(message.guild, current.modlog, {
                heading: "Member Timed Out",
                iconUrl: message.author.displayAvatarURL(),
                body: `${message.author.displayName} ${message.author.tag}`,
                reason: "Detected Crypto Scam",
                userId: message.author.id,
                at: message.createdTimestamp
            });
        }
    },
};
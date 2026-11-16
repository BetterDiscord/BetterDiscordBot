import {Events, Message} from "discord.js";
import {guildDB} from "../db";
import {deleteMessage, getModlogChannel, isFilterable, logMemberAction, timeoutAuthor, warnCompromisedAccount} from "../util/moderation";


const TIMEOUT_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
const TARGET_GUILD_ID = "86004744966914048";
const sketchyImageRegex = /https:\/\/(?:cdn|media)\.(?:discord|discordapp)\.(?:com|net)\/attachments\/\d+\/\d+\/(?:[1234]|image)\.(?:jpg|png|webp)(?:\?.*?)?(?:\s+|$)/;


export default {
    name: Events.MessageCreate,

    async execute(message: Message) {
        if (!isFilterable(message)) return;
        if (message.guild.id !== TARGET_GUILD_ID) return;

        // Obviously if this is disabled we don't need to do this stuff either
        const current = await guildDB.get(message.guild.id) ?? {};
        if (!current?.detectspam) return;

        // Current scam images always have 4 attachments, so if it's not 4 attachments it's not a scam image. Let's get out of here
        if (message.attachments.size !== 4) return;

        const allSketchy = message.attachments.every(a => sketchyImageRegex.test(a.url));
        if (!allSketchy) return; // Not spam, let's get out of here

        await deleteMessage(message, "detect spam");
        const didTimeout = await timeoutAuthor(message, TIMEOUT_DURATION, "Detected Crypto Scam");
        await warnCompromisedAccount(message);

        const modlog = getModlogChannel(message, current);
        if (didTimeout && modlog) await logMemberAction(modlog, message, "Member Timed Out", "Detected Crypto Scam");
    },
};

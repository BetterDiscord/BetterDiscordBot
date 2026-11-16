import {Events, Message} from "discord.js";
import {guildDB} from "../db";
import type {GuildSettings} from "../types";
import {deleteMessage, getModlogChannel, isFilterable, logMemberAction, logScamImage, timeoutAuthor, warnCompromisedAccount} from "../util/moderation";
import {recordScan, scanImages} from "../util/scamimages";


const TIMEOUT_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
const TIMEOUT_REASON = "Detected Crypto Scam";
const TARGET_GUILD_ID = "86004744966914048";
const sketchyImageRegex = /https:\/\/(?:cdn|media)\.(?:discord|discordapp)\.(?:com|net)\/attachments\/\d+\/\d+\/(?:[1234]|image)\.(?:jpg|png|webp)(?:\?.*?)?(?:\s+|$)/;

/** The most common form of the scam is four images named 1 to 4 (or all named "image") */
function hasKnownScamShape(message: Message<true>): boolean {
    return message.attachments.size === 4 && message.attachments.every(a => sketchyImageRegex.test(a.url));
}

/** Removes the message and times its author out. Returns whether the timeout was applied. */
async function removeScam(message: Message<true>): Promise<boolean> {
    await deleteMessage(message, "scam image");
    const didTimeout = await timeoutAuthor(message, TIMEOUT_DURATION, TIMEOUT_REASON);
    await warnCompromisedAccount(message);
    return didTimeout;
}

export default {
    name: Events.MessageCreate,

    async execute(message: Message) {
        if (!isFilterable(message)) return;
        const settings: GuildSettings = await guildDB.get(message.guild.id) ?? {};
        const modlog = getModlogChannel(message, settings);

        // The known shape is recognized from the file names alone, so those messages never need their images read
        if (settings.detectspam && message.guild.id === TARGET_GUILD_ID && hasKnownScamShape(message)) {
            const didTimeout = await removeScam(message);
            if (didTimeout && modlog) await logMemberAction(modlog, message, "Member Timed Out", TIMEOUT_REASON);
            return;
        }

        if (!settings.scamimages) return;

        const scan = await scanImages(message);
        if (!scan.imagesScanned) return;
        await recordScan(message.guild.id, scan);
        if (!scan.flagged) return;

        // In log mode the message and its author are left alone, and the mod log is the only record
        const isEnforced = settings.scamimages === "enforce";
        const didTimeout = isEnforced && await removeScam(message);

        if (!modlog) return;
        await logScamImage(modlog, message, scan.flagged, isEnforced);
        if (didTimeout) await logMemberAction(modlog, message, "Member Timed Out", TIMEOUT_REASON);
    },
};

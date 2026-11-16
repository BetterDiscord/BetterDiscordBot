import {Events, Message} from "discord.js";
import {guildDB} from "../db";
import type {GuildSettings} from "../types";
import {deleteMessage, getModlogChannel, isFilterable, logMemberAction, logScamImage, notifyCompromisedAccount, timeoutAuthor, warnCompromisedAccount, type RemovalOutcome} from "../util/moderation";
import {recordScan, scanImages} from "../util/scamimages";


const TIMEOUT_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
const TIMEOUT_REASON = "Detected Crypto Scam";
const TARGET_GUILD_ID = "86004744966914048";
const sketchyImageRegex = /https:\/\/(?:cdn|media)\.(?:discord|discordapp)\.(?:com|net)\/attachments\/\d+\/\d+\/(?:[1234]|image)\.(?:jpg|png|webp)(?:\?.*?)?(?:\s+|$)/;

/** The most common form of the scam is four images named 1 to 4 (or all named "image") */
function hasKnownScamShape(message: Message<true>): boolean {
    return message.attachments.size === 4 && message.attachments.every(a => sketchyImageRegex.test(a.url));
}

/** Removes the message, times its author out, and warns them in the server and in a direct message. Returns which steps worked. */
async function removeScam(message: Message<true>): Promise<RemovalOutcome> {
    const wasDeleted = await deleteMessage(message, "scam image");
    const didTimeout = await timeoutAuthor(message, TIMEOUT_DURATION, TIMEOUT_REASON);
    await warnCompromisedAccount(message);

    const wasNotified = await notifyCompromisedAccount(message);
    return {wasDeleted, didTimeout, wasNotified};
}

export default {
    name: Events.MessageCreate,

    async execute(message: Message) {
        if (!isFilterable(message)) return;
        const settings: GuildSettings = await guildDB.get(message.guild.id) ?? {};
        const modlog = getModlogChannel(message, settings);

        // The known shape is recognized from the file names alone, so those messages never need their images read
        if (settings.detectspam && message.guild.id === TARGET_GUILD_ID && hasKnownScamShape(message)) {
            const {didTimeout} = await removeScam(message);
            if (didTimeout && modlog) await logMemberAction(modlog, message, "Member Timed Out", TIMEOUT_REASON);
            return;
        }

        if (!settings.scamimages) return;

        const scan = await scanImages(message);
        if (!scan.imagesScanned) return;
        await recordScan(message.guild.id, scan);
        if (!scan.flagged) return;

        // In log mode the message and its author are left alone, and the mod log is the only record
        const outcome = settings.scamimages === "enforce" ? await removeScam(message) : undefined;

        if (!modlog) return;
        await logScamImage(modlog, message, scan.flagged, outcome);
        if (outcome?.didTimeout) await logMemberAction(modlog, message, "Member Timed Out", TIMEOUT_REASON);
    },
};

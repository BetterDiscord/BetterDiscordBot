import {Events, Message} from "discord.js";
import {guildDB} from "../db";
import {deleteMessage, getModlogChannel, isFilterable, logMemberAction, logRemovedMessage, muteAuthor} from "../util/moderation";


const fakeDiscordRegex = new RegExp(`([a-zA-Z-\\.]+)?d[il][il]?scorr?(cl|[ldb])([a-zA-Z-\\.]+)?\\.(com|net|app|gift|ru|uk)`, "ig");
const okayDiscordRegex = new RegExp(`([a-zA-Z-\\.]+\\.)?discord((?:app)|(?:status))?\\.(com|net|app)`, "i");
const fakeSteamRegex = new RegExp(`str?e[ea]?mcomm?m?un[un]?[un]?[tl]?[il][tl]?ty\\.(com|net|ru|us)`, "ig");
const sketchyRuRegex = new RegExp(`([a-zA-Z-\\.]+).ru.com`, "ig");


export default {
    name: Events.MessageCreate,

    async execute(message: Message) {
        if (!isFilterable(message)) return;

        // Obviously if this is disabled we don't need to do this stuff either
        const current = await guildDB.get(message.guild.id) ?? {};
        if (!current?.detectspam) return;


        const fakeDiscordMatches = message.content.match(fakeDiscordRegex) || [];
        const fakeSteamMatches = message.content.match(fakeSteamRegex) || [];
        const isFakeDiscord = fakeDiscordMatches.some(s => {
            if (okayDiscordRegex.test(s)) return false;
            else if (s.toLowerCase() === "betterdiscord.app") return false;
            return true;
        });
        const isFakeSteam = fakeSteamMatches.some(s => s.toLowerCase() !== "steamcommunity.com");
        const isSketchy = sketchyRuRegex.test(message.content);
        if (!isFakeDiscord && !isFakeSteam && !isSketchy) return; // Not spam, let's get out of here

        let reason = "Sketchy Link";
        if (isFakeDiscord) reason = "Fake Discord Link";
        if (isFakeSteam) reason = "Fake Steam Link";

        await deleteMessage(message, "detect spam");
        const didMute = await muteAuthor(message);

        const modlog = getModlogChannel(message, current);
        if (!modlog) return; // Can't log

        await logRemovedMessage(modlog, message, reason);
        if (didMute) await logMemberAction(modlog, message, "Member Muted", reason);
    },
};

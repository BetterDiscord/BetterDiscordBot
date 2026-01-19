import {EmbedBuilder, Events, Message, PermissionFlagsBits} from "discord.js";
import {guildDB} from "../db";
import Colors from "../util/colors";

type Patterns = {
    regex: RegExp,
    whitelist: string[],
    predicate: (links: RegExpMatchArray[], self: Patterns) => boolean,
    reason: string,
    maxCount?: number,
}

const phishingPatterns = [
    {
        regex: /([a-zA-Z-\\.]+)?d[il][il]?scorr?(cl|[ldb])([a-zA-Z-\\.]+)?\.(com|net|app|gift|ru|uk)/ig,
        whitelist: ['discord.com', 'discordapp.com'],
        predicate: (links, self) => {
            const hosts = links.map(match => {
                const url = match[0];
                const fullUrl = url.startsWith('http') ? url : `https://${url}`;
                return URL.parse(fullUrl)?.host;
            }).filter(Boolean);
            return hosts.some(host => !self.whitelist.includes(host));
        },
        reason: 'Fake Discord Domain'
    },
    {
        regex: /str?e[ea]?mcomm?m?un[un]?[un]?[tl]?[il][tl]?ty\.(com|net|ru|us)/ig,
        whitelist: ['steamcommunity.com'],
        predicate: (links, self) => {
            const hosts = links.map(match => {
                const url = match[0];
                const fullUrl = url.startsWith('http') ? url : `https://${url}`;
                return URL.parse(fullUrl)?.host;
            }).filter(Boolean);

            return hosts.some(host => !self.whitelist.includes(host));
        },
        reason: 'Fake Steam Link'
    },
    {
        regex: /([a-zA-Z-\\.]+)\.ru\.com/ig,
        whitelist: [],
        predicate: (links) => links.length > 0,
        reason: 'Suspicious .ru.com Domain'
    },
    {
        regex: /nsfwcord/ig, // new recent scam
        whitelist: [],
        predicate: (links) => links.length > 0,
        reason: 'Sex bot scam'
    },
    {
        regex: /(?:http[s]?:\/\/.)?(?:www\.)?[-a-zA-Z0-9@%._+~#=]{2,256}\.[a-z]{2,6}\b[-a-zA-Z0-9@:%_+.~#?&\/=]*/ig,
        whitelist: [],
        predicate: (links, self) => links.length == self.maxCount, // this should probably be more than 4 later on.
        reason: 'Potential Scam Message',
        maxCount: 4
    }
] as Patterns[]

// TODO: consider de-duping with invitefilter event
export default {
    name: Events.MessageCreate,

    async execute(message: Message) {
        // Ignore DM messages and owner messages and people with manage messages perms
        if (!message.inGuild() || message.author.id === process.env.BOT_OWNER_ID) return;
        if (message.author.id === message.client.user.id) return;
        if (message.channel.permissionsFor(message.author)?.has(PermissionFlagsBits.ManageMessages)) return;

        // Obviously if this is disabled we don't need to do this stuff either
        const current = await guildDB.get(message.guild.id) ?? {};
        if (!current?.detectspam) return;

        /*
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
        
                try {
                    await message.delete();
                }
                catch {
                    // TODO: logging?
                    console.error("Could not delete detect spam message. Likely permissions.");
                }*/

        let reasons: string[] = [];

        for (const pattern of phishingPatterns) {
            const links = Array.from(message.content.matchAll(pattern.regex))
            const shouldReason = pattern.predicate(links)
            if (shouldReason) {
                reasons.push(pattern.reason)
            }
        }

        if (reasons.length === 0) return;

        try {
            await message.delete();
        } catch (e) {
            console.error("Could not delete message. Likely deleted or no permissions.", e);
        }


        let didMute = false;
        const muteRoleId = message.guild.roles.cache.findKey(r => r.name.toLowerCase().includes("mute"));
        if (muteRoleId) {
            const member = message.guild.members.cache.get(message.author.id);
            if (member && !member.roles.cache.has(muteRoleId)) {
                try {
                    await member.roles.add(muteRoleId);
                    didMute = true;
                } catch {
                    // TODO: logging?
                    console.error("Could not add mute role. Likely permissions.");
                }
            }
        }

        const modlogId = current.modlog;
        const modlogChannel = message.guild.channels.cache.get(modlogId!);
        if (!modlogId || !modlogChannel || !modlogChannel.isTextBased()) return; // Can't log

        const dEmbed = new EmbedBuilder().setColor(Colors.Info)
            .setAuthor({name: message.author.username, iconURL: message.author.displayAvatarURL()})
            .setDescription(`Message sent by ${message.author.username} in ${message.channel.name}\n\n` + message.content)
            .addFields({name: "Reason(s)", value: reasons.join(', ')})
            .setFooter({text: `ID: ${message.author.id}`}).setTimestamp(message.createdTimestamp);
        await modlogChannel.send({embeds: [dEmbed]});


        if (didMute) {
            const mEmbed = new EmbedBuilder().setColor(Colors.Info)
                .setAuthor({name: "Member Muted", iconURL: message.author.displayAvatarURL()})
                .setDescription(`${message.author.displayName} ${message.author.tag}`)
                .addFields({name: "Reason(s)", value: reasons.join(', ')})
                .setFooter({text: `ID: ${message.author.id}`}).setTimestamp(message.createdTimestamp);

            await modlogChannel.send({embeds: [mEmbed]});
        }
    },
};
const {Events, EmbedBuilder, PermissionFlagsBits} = require("discord.js");
const path = require("path");
const Keyv = require("keyv");
const Colors = require("../util/colors");
const settings = new Keyv("sqlite://" + path.resolve(__dirname, "..", "..", "settings.sqlite3"), {namespace: "settings"});


const discordInviteRegex = new RegExp(`(?:https?:\\/\\/)?discord\\.gg\\/?([A-Z0-9]+)`, "ig");
const oldInviteRegex = new RegExp(`(?:https?:\\/\\/)?discordapp\\.com\\/invite\\/?([A-Z0-9]+)`, "ig");

// TODO: maybe make configurable?
const whitelist = ["0Tmfo5ZbORCRqbAd"];

module.exports = {
    name: Events.MessageCreate,

    /** 
     * @param {import("discord.js").Message} message
     */
    async execute(message) {
        // Ignore DM messages and owner messages and people with manage messages perms
        if (!message.inGuild() || message.author.id === process.env.BOT_OWNER_ID) return;
        if (message.channel.permissionsFor(message.author)?.has(PermissionFlagsBits.ManageMessages)) return;

        // Obviously if this is disabled we don't need to do this stuff either
        const current = await settings.get(message.guild.id) ?? {};
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

        const modlogId = current.modlog;
        const modlogChannel = message.guild.channels.cache.get(modlogId);
        if (!modlogId || !modlogChannel) return; // Can't log

        const dEmbed = new EmbedBuilder().setColor(Colors.Info)
            .setAuthor({name: message.author.username, iconURL: message.author.displayAvatarURL()})
            .setDescription(`Message sent by ${message.author.username} in ${message.channel}\n\n` + message.content)
            .addFields({name: "Reason", value: "Discord Invite"})
            .setFooter({text: `ID: ${message.author.id}`}).setTimestamp(message.createdTimestamp);
        modlogChannel.send({embeds: [dEmbed]});
        

        if (didMute) {
            const mEmbed = new EmbedBuilder().setColor(Colors.Info)
                .setAuthor({name: "Member Muted", iconURL: message.author.displayAvatarURL()})
                .setDescription(`${message.author} ${message.author.tag}`)
                .addFields({name: "Reason", value: "Discord Invite"})
                .setFooter({text: `ID: ${message.author.id}`}).setTimestamp(message.createdTimestamp);

            modlogChannel.send({embeds: [mEmbed]});
        }
    },
};
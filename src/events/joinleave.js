const {Events} = require("discord.js");
const path = require("path");
const Keyv = require("keyv");
const Messages = require("../util/messages");
const settings = new Keyv("sqlite://" + path.resolve(__dirname, "..", "..", "settings.sqlite3"), {namespace: "settings"});



module.exports = [
    {
        name: Events.GuildMemberAdd,

        /** 
         * @param {import("discord.js").GuildMember} member
         */
        async execute(member) {
            const guildSettings = await settings.get(member.guild.id);
            if (!guildSettings || !guildSettings.joinleave) return;
            const channel = member.guild.channels.cache.get(guildSettings.joinleave);
            await channel.send(Messages.success(`<@!${member.user.id}> has joined the server!`));
        },
    },
    {
        name: Events.GuildMemberRemove,

        /** 
         * @param {import("discord.js").GuildMember} member
         */
        async execute(member) {
            const guildSettings = await settings.get(member.guild.id);
            if (!guildSettings || !guildSettings.joinleave) return;
            const channel = member.guild.channels.cache.get(guildSettings.joinleave);
            await channel.send(Messages.error(`**${member.user.tag} (${member.user.id})** has left the server!`));
        },
    }
];
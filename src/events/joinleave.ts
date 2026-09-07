import {Events, type GuildMember} from "discord.js";
import {guildDB} from "../db";
import * as notices from "../util/notices";




export default [
    {
        name: Events.GuildMemberAdd,

        async execute(member: GuildMember) {
            const guildSettings = await guildDB.get(member.guild.id);
            if (!guildSettings || !guildSettings.joinleave) return;
            const channel = member.guild.channels.cache.get(guildSettings.joinleave);
            if (!channel || !channel.isTextBased()) return;
            await channel.send(notices.success(`<@!${member.user.id}> has joined the server!`));
        },
    },
    {
        name: Events.GuildMemberRemove,

        async execute(member: GuildMember) {
            const guildSettings = await guildDB.get(member.guild.id);
            if (!guildSettings || !guildSettings.joinleave) return;
            const channel = member.guild.channels.cache.get(guildSettings.joinleave);
            if (!channel || !channel.isTextBased()) return;
            await channel.send(notices.error(`**${member.user.tag} (${member.user.id})** has left the server!`));
        },
    }
];
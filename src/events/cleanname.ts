import {Events, type GuildMember} from "discord.js";
import {guildDB} from "../db";


// TODO: put this somewhere common to avoid double maintenance
const weirdCharsRegex = /[^A-Za-z0-9\-_\\. ]/g;

export default {
    name: Events.GuildMemberAdd,

    async execute(member: GuildMember) {
        if (!weirdCharsRegex.test(member.displayName)) return; // TODO: maybe log?

        const guildSettings = await guildDB.get(member.guild.id);
        if (!guildSettings?.cleanOnJoin) return;

        try {
            await member.setNickname(member.user.username);
        }
        catch {
            // TODO: log this?
        }
    },
};
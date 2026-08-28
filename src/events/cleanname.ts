import {Events, type GuildMember} from "discord.js";
import {guildDB} from "../db";
import {hasDisallowedChars} from "../util/names";

export default {
    name: Events.GuildMemberAdd,

    async execute(member: GuildMember) {
        if (!hasDisallowedChars(member.displayName)) return; // TODO: maybe log?

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
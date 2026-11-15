import {Events, GuildMember} from "discord.js";
import config from "../config";


export default {
    name: Events.GuildMemberAdd,

    async execute(member: GuildMember) {
        const bdGuild = await member.client.guilds.fetch(config.guilds.betterDiscord);
        const bdMember = await bdGuild.members.fetch(member);
        if (!bdMember) return;

        const isPluginDev = bdMember.roles.cache.has(config.roles.pluginDeveloper);
        const isThemeDev = bdMember.roles.cache.has(config.roles.themeDeveloper);
        const rolesToAdd = [isPluginDev ? config.roles.communityPluginDeveloper : "", isThemeDev ? config.roles.communityThemeDeveloper : ""].filter(r => r);

        try {
            await member.roles.add(rolesToAdd, "Syncing roles from main server");
        }
        catch {
            // TODO: add logging
        }
    },
};
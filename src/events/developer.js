const {Events} = require("discord.js");


module.exports = {
    name: Events.GuildMemberAdd,

    /** 
     * @param {import("discord.js").GuildMember} member
     */
    async execute(member) {
        const bdGuild = await member.client.guilds.fetch("86004744966914048");
        const bdMember = await bdGuild.members.fetch(member);
        if (!bdMember) return;

        const isPluginDev = bdMember.roles.cache.has("125166040689803264");
        const isThemeDev = bdMember.roles.cache.has("165005972970930176");
        const rolesToAdd = [isPluginDev ? "948627723830591568" : "", isThemeDev ? "948627648706392104" : ""].filter(r => r);

        try { 
            await member.roles.add(rolesToAdd, "Syncing roles from main server");
        }
        catch {
            // TODO: add logging
        }
    },
};
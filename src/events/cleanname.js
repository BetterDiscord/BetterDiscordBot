const {Events} = require("discord.js");
const path = require("path");
const Keyv = require("keyv");
const settings = new Keyv("sqlite://" + path.resolve(__dirname, "..", "..", "settings.sqlite3"), {namespace: "settings"});


// TODO: put this somewhere common to avoid double maintenance
const weirdCharsRegex = /[^A-Za-z0-9\-_\\. ]/g;

module.exports = {
    name: Events.GuildMemberAdd,

    /** 
     * @param member {import("discord.js").GuildMember}
     */
    async execute(member) {
        if (!weirdCharsRegex.test(member.displayName)) return; // TODO: maybe log?

        const guildSettings = await settings.get(member.guild.id);
        if (!guildSettings?.cleanOnJoin) return;

        try {
            await member.setNickname(member.user.username);
        }
        catch {
            // TODO: log this?
        }
    },
};
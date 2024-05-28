const {Events} = require("discord.js");
const path = require("path");
const Keyv = require("keyv");
const settings = new Keyv("sqlite://" + path.resolve(__dirname, "..", "..", "settings.sqlite3"), {namespace: "voicetext"});


module.exports = {
    name: Events.VoiceStateUpdate,

    /** 
     * @param {import("discord.js").VoiceState} oldState
     * @param {import("discord.js").VoiceState} newState
     */
    async execute(oldState, newState) {

        const oldPartner = await settings.get(oldState.channelId) ?? "";
        const newPartner = await settings.get(newState.channelId) ?? "";

        // Most common case: they arent in a bound channel, ignore
        const didChange = newState.channelId !== oldState.channelId;
        if (!oldPartner && !newPartner) return;


        // User left a bound channel, revoke override perm
        if (oldPartner && didChange) {
            /**
             * @type {import("discord.js").GuildChannel}
             */
            const text = newState.guild.channels.cache.get(oldPartner);
            try {
                await text.permissionOverwrites.delete(oldState.id, "Left bound text channel");
            }
            catch (err) {
                console.error(err);
            }
        }


        // User joined a bound channel, grant override perm
        if (newPartner && didChange) {
            /**
             * @type {import("discord.js").GuildChannel}
             */
            const text = newState.guild.channels.cache.get(newPartner);
            try {
                await text.permissionOverwrites.edit(newState.id, {SendMessages: true}, "Joined bound text channel");
            }
            catch (err) {
                console.error(err);
            }
        }
    },
};
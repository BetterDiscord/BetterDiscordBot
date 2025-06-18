import {ChannelType, Events, type VoiceState} from "discord.js";
import {voicetextDB} from "../db";



export default {
    name: Events.VoiceStateUpdate,

    /**
     * @param {import("discord.js").VoiceState} oldState
     * @param {import("discord.js").VoiceState} newState
     */
    async execute(oldState: VoiceState, newState: VoiceState) {

        const oldPartner = await voicetextDB.get<string>(oldState.channelId ?? "") ?? "";
        const newPartner = await voicetextDB.get<string>(newState.channelId ?? "") ?? "";

        // Most common case: they arent in a bound channel, ignore
        const didChange = newState.channelId !== oldState.channelId;
        if (!oldPartner && !newPartner) return;


        // User left a bound channel, revoke override perm
        if (oldPartner && didChange) {
            const text = newState.guild.channels.cache.get(oldPartner);
            try {
                if (text?.type === ChannelType.GuildText) {
                    await text.permissionOverwrites.delete(oldState.id, "Left bound text channel");
                }
            }
            catch (err) {
                console.error(err);
            }
        }


        // User joined a bound channel, grant override perm
        if (newPartner && didChange) {
            const text = newState.guild.channels.cache.get(newPartner);
            try {
                if (text?.type === ChannelType.GuildText) {
                    await text.permissionOverwrites.edit(newState.id, {SendMessages: true}, {reason: "Joined bound text channel"});
                }
            }
            catch (err) {
                console.error(err);
            }
        }
    },
};
import {Events, type Message} from "discord.js";
import {autoresponderDB, guildDB} from "../db";


export default {
    name: Events.MessageCreate,

    async execute(message: Message) {
        if (!message.inGuild() || message.author.bot) return;

        const guildSettings = await guildDB.get(message.guild.id);
        if (!guildSettings?.autoresponder) return;

        const entries = await autoresponderDB.get(message.guild.id) ?? [];
        if (!entries.length) return;

        const content = message.content.toLowerCase();
        const match = entries.find(entry => {
            const trigger = entry.trigger;
            if (entry.matchType === "exact") return content === trigger;
            if (entry.matchType === "startsWith") return content.startsWith(trigger);
            return content.includes(trigger);
        });

        if (!match) return;

        await message.reply(match.response).catch(console.error);
    },
};

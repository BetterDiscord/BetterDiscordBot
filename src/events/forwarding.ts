import {EmbedBuilder, Events, type Message} from "discord.js";
import {globalDB} from "../db";


export default {
    name: Events.MessageCreate,

    /**
     * @param {import("discord.js").Message} message
     */
    async execute(message: Message) {
        // Ignore guild messages and owner DMs
        if (message.inGuild() || message.author.bot) return;
        if (message.author.id === message.client.user.id) return;
        if (message.author.id === process.env.BOT_OWNER_ID) return;
        const target = await globalDB.get("forwarding") as string ?? "";
        if (!target) return;
        const user = message.client.users.cache.get(target);
        if (!user) return;

        const embed = new EmbedBuilder()
            .setAuthor({name: `${message.author.displayName} (${message.author.id})`, iconURL: message.author.displayAvatarURL()})
            .setDescription(message.content ?? "\u200B");

        if (message.attachments.size) {
            for (const [id, att] of message.attachments) {
                embed.addFields({name: att.name, value: `[${id}](${att.url})`});
            }
        }

        await user.send({embeds: [embed]});
    },
};
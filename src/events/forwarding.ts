import {Events, MessageFlags, type Message} from "discord.js";
import {container, text} from "../framework";
import {Accents} from "../util/colors";
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

        const lines = [
            `### ${message.author.displayName} (${message.author.id})`,
            message.content || "\u200B"
        ];

        for (const [id, attachment] of message.attachments) {
            lines.push(`**${attachment.name}** — [${id}](${attachment.url})`);
        }

        await user.send({
            flags: MessageFlags.IsComponentsV2,
            components: [container(lines.map(text), {accentColor: Accents.Info})]
        });
    },
};
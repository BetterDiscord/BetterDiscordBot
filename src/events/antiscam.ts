import { Events, GuildMember, Message, MessageFlags } from "discord.js";
import Messages from "../util/messages";

const URL_REGEX =
    /(?:http[s]?:\/\/.)?(?:www\.)?[-a-zA-Z0-9@%._\+~#=]{2,256}\.[a-z]{2,6}\b(?:[-a-zA-Z0-9@:%_\+.~#?&\/\/=]*)/g;

const isStaff = (author: GuildMember) =>
    author.permissions.has("ManageMessages");

export default {
    name: Events.MessageCreate,

    async execute(message: Message) {
        const content = message.content;

        const linkAmount = Array.from(content.matchAll(URL_REGEX));
        const guildMember = message.guild?.members.cache.get(message.author.id);
        if (linkAmount.length == 4 && guildMember && !isStaff(guildMember)) {
            try {
                const reply = await message.reply(
                    Messages.error("This message contains potential scam material.")
                );
                await message.delete();

                setTimeout(() => reply.delete().catch(() => { }), 3000);
            } catch (error) {
                // this should never happen but this is so the bot doesnt disconect.
            }
        }
    },
};

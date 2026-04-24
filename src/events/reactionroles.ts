import {Events, type MessageReaction, type PartialMessageReaction, type PartialUser, type User} from "discord.js";
import {reactionrolesDB} from "../db";


/**
 * Normalise a reaction emoji to the same key used when storing reaction roles.
 * - Custom emoji → numeric ID
 * - Unicode emoji → the character itself
 */
function normalizeReactionEmoji(emoji: MessageReaction["emoji"]): string {
    return emoji.id ?? emoji.name ?? "";
}


export default [
    {
        name: Events.MessageReactionAdd,

        async execute(rawReaction: MessageReaction | PartialMessageReaction, rawUser: User | PartialUser) {
            if (rawUser.bot) return;

            const reaction = rawReaction.partial ? await rawReaction.fetch().catch(() => null) : rawReaction;
            if (!reaction) return;

            const user = rawUser.partial ? await rawUser.fetch().catch(() => null) : rawUser;
            if (!user) return;

            if (!reaction.message.guildId) return;

            const entries = await reactionrolesDB.get(reaction.message.guildId) ?? [];
            const normalizedEmoji = normalizeReactionEmoji(reaction.emoji);
            const entry = entries.find(r => r.messageId === reaction.message.id && r.emoji === normalizedEmoji);
            if (!entry) return;

            const guild = reaction.message.guild;
            if (!guild) return;

            const member = await guild.members.fetch(user.id).catch(() => null);
            if (!member) return;

            await member.roles.add(entry.roleId).catch(console.error);
        },
    },
    {
        name: Events.MessageReactionRemove,

        async execute(rawReaction: MessageReaction | PartialMessageReaction, rawUser: User | PartialUser) {
            if (rawUser.bot) return;

            const reaction = rawReaction.partial ? await rawReaction.fetch().catch(() => null) : rawReaction;
            if (!reaction) return;

            const user = rawUser.partial ? await rawUser.fetch().catch(() => null) : rawUser;
            if (!user) return;

            if (!reaction.message.guildId) return;

            const entries = await reactionrolesDB.get(reaction.message.guildId) ?? [];
            const normalizedEmoji = normalizeReactionEmoji(reaction.emoji);
            const entry = entries.find(r => r.messageId === reaction.message.id && r.emoji === normalizedEmoji);
            if (!entry) return;

            const guild = reaction.message.guild;
            if (!guild) return;

            const member = await guild.members.fetch(user.id).catch(() => null);
            if (!member) return;

            await member.roles.remove(entry.roleId).catch(console.error);
        },
    },
];

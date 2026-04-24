import {ChannelType, ChatInputCommandInteraction, EmbedBuilder, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder} from "discord.js";
import {reactionrolesDB} from "../db";
import Messages from "../util/messages";
import Colors from "../util/colors";


/**
 * Normalise an emoji string (as typed by a user) to a stable key.
 * - Custom emoji  "<:name:id>" or "<a:name:id>" → just the numeric ID
 * - Unicode emoji → the character itself (e.g. "👍")
 */
function normalizeEmojiString(emoji: string): string {
    const match = emoji.match(/^<a?:[^:]+:(\d+)>$/);
    return match ? match[1] : emoji;
}


export default {
    data: new SlashCommandBuilder()
        .setName("reactionroles")
        .setDescription("Configure reaction roles for your server.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .setContexts(InteractionContextType.Guild)
        .addSubcommand(c =>
            c.setName("add").setDescription("Add a reaction role to a message.")
                .addChannelOption(opt =>
                    opt.setName("channel").setDescription("The channel the message is in.").setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)
                )
                .addStringOption(opt =>
                    opt.setName("message_id").setDescription("The ID of the message.").setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName("emoji").setDescription("The emoji to react with.").setRequired(true)
                )
                .addRoleOption(opt =>
                    opt.setName("role").setDescription("The role to assign.").setRequired(true)
                )
        )
        .addSubcommand(c =>
            c.setName("remove").setDescription("Remove a reaction role from a message.")
                .addChannelOption(opt =>
                    opt.setName("channel").setDescription("The channel the message is in.").setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)
                )
                .addStringOption(opt =>
                    opt.setName("message_id").setDescription("The ID of the message.").setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName("emoji").setDescription("The emoji to remove.").setRequired(true)
                )
        )
        .addSubcommand(c =>
            c.setName("list").setDescription("List all reaction roles in this server.")
        ),


    async execute(interaction: ChatInputCommandInteraction<"cached">) {
        const command = interaction.options.getSubcommand();
        if (command === "add") return await this.add(interaction);
        if (command === "remove") return await this.remove(interaction);
        if (command === "list") return await this.list(interaction);
    },


    async add(interaction: ChatInputCommandInteraction<"cached">) {
        await interaction.deferReply({ephemeral: true});
        const channelOption = interaction.options.getChannel("channel", true);
        const messageId = interaction.options.getString("message_id", true);
        const emojiInput = interaction.options.getString("emoji", true);
        const role = interaction.options.getRole("role", true);
        const normalizedEmoji = normalizeEmojiString(emojiInput);

        const textChannel = interaction.guild.channels.cache.get(channelOption.id);
        if (!textChannel?.isTextBased()) return await interaction.editReply(Messages.error("Invalid channel."));

        // Validate that the message exists and add the bot's reaction
        try {
            const targetMessage = await textChannel.messages.fetch(messageId);
            await targetMessage.react(emojiInput);
        }
        catch {
            return await interaction.editReply(Messages.error("Could not find that message or react with that emoji. Check the message ID and emoji are correct."));
        }

        const current = await reactionrolesDB.get(interaction.guild.id) ?? [];

        if (current.some(r => r.messageId === messageId && r.emoji === normalizedEmoji)) {
            return await interaction.editReply(Messages.warn("A reaction role with that emoji already exists on that message."));
        }

        current.push({messageId, channelId: channelOption.id, emoji: normalizedEmoji, roleId: role.id});
        await reactionrolesDB.set(interaction.guild.id, current);

        await interaction.editReply(Messages.success(`Reaction role added! Reacting with ${emojiInput} on that message will assign <@&${role.id}>.`));
    },


    async remove(interaction: ChatInputCommandInteraction<"cached">) {
        await interaction.deferReply({ephemeral: true});
        const channelOption = interaction.options.getChannel("channel", true);
        const messageId = interaction.options.getString("message_id", true);
        const emojiInput = interaction.options.getString("emoji", true);
        const normalizedEmoji = normalizeEmojiString(emojiInput);

        const current = await reactionrolesDB.get(interaction.guild.id) ?? [];
        const index = current.findIndex(r => r.messageId === messageId && r.channelId === channelOption.id && r.emoji === normalizedEmoji);

        if (index === -1) return await interaction.editReply(Messages.error("No reaction role found with that emoji on that message."));

        current.splice(index, 1);
        await reactionrolesDB.set(interaction.guild.id, current);

        await interaction.editReply(Messages.success("Reaction role removed successfully."));
    },


    async list(interaction: ChatInputCommandInteraction<"cached">) {
        await interaction.deferReply({ephemeral: true});
        const current = await reactionrolesDB.get(interaction.guild.id) ?? [];

        if (!current.length) return await interaction.editReply(Messages.info("No reaction roles are configured for this server."));

        const description = current
            .map(r => `${r.emoji} → <@&${r.roleId}> (in <#${r.channelId}>, msg: \`${r.messageId}\`)`)
            .join("\n");

        const embed = new EmbedBuilder()
            .setColor(Colors.Info)
            .setTitle("Reaction Roles")
            .setDescription(description);

        await interaction.editReply({embeds: [embed]});
    },
};

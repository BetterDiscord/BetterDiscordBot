import {ChatInputCommandInteraction, EmbedBuilder, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder} from "discord.js";
import {guildDB, warningsDB} from "../db";
import Messages from "../util/messages";
import Colors from "../util/colors";
import type {Warning} from "../types";


async function logModAction(interaction: ChatInputCommandInteraction<"cached">, action: string, targetId: string, reason: string) {
    const settings = await guildDB.get(interaction.guild.id);
    const logChannelId = settings?.modlog;
    if (!logChannelId) return;
    const logChannel = interaction.guild.channels.cache.get(logChannelId);
    if (!logChannel?.isTextBased()) return;

    const embed = new EmbedBuilder()
        .setColor(Colors.Warn)
        .setTitle(`Member ${action}`)
        .addFields(
            {name: "User", value: `<@${targetId}> (${targetId})`, inline: true},
            {name: "Moderator", value: `<@${interaction.user.id}>`, inline: true},
            {name: "Reason", value: reason}
        )
        .setTimestamp();

    await logChannel.send({embeds: [embed]}).catch(console.error);
}


export default {
    data: new SlashCommandBuilder()
        .setName("mod")
        .setDescription("Moderation actions.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setContexts(InteractionContextType.Guild)
        .addSubcommand(c =>
            c.setName("kick").setDescription("Kick a member from the server.")
                .addUserOption(opt => opt.setName("user").setDescription("The user to kick.").setRequired(true))
                .addStringOption(opt => opt.setName("reason").setDescription("Reason for the kick."))
        )
        .addSubcommand(c =>
            c.setName("ban").setDescription("Ban a user from the server.")
                .addUserOption(opt => opt.setName("user").setDescription("The user to ban.").setRequired(true))
                .addStringOption(opt => opt.setName("reason").setDescription("Reason for the ban."))
                .addIntegerOption(opt => opt.setName("delete_days").setDescription("Days of messages to delete (0–7).").setMinValue(0).setMaxValue(7))
        )
        .addSubcommand(c =>
            c.setName("unban").setDescription("Unban a user from the server.")
                .addStringOption(opt => opt.setName("user_id").setDescription("The user ID to unban.").setRequired(true))
                .addStringOption(opt => opt.setName("reason").setDescription("Reason for the unban."))
        )
        .addSubcommand(c =>
            c.setName("timeout").setDescription("Timeout (mute) a member.")
                .addUserOption(opt => opt.setName("user").setDescription("The user to timeout.").setRequired(true))
                .addIntegerOption(opt => opt.setName("duration").setDescription("Duration in minutes.").setRequired(true).setMinValue(1).setMaxValue(40320))
                .addStringOption(opt => opt.setName("reason").setDescription("Reason for the timeout."))
        )
        .addSubcommand(c =>
            c.setName("untimeout").setDescription("Remove a timeout from a member.")
                .addUserOption(opt => opt.setName("user").setDescription("The user to remove the timeout from.").setRequired(true))
                .addStringOption(opt => opt.setName("reason").setDescription("Reason for removing the timeout."))
        )
        .addSubcommand(c =>
            c.setName("warn").setDescription("Warn a member.")
                .addUserOption(opt => opt.setName("user").setDescription("The user to warn.").setRequired(true))
                .addStringOption(opt => opt.setName("reason").setDescription("Reason for the warning.").setRequired(true))
        )
        .addSubcommand(c =>
            c.setName("warnings").setDescription("View warnings for a member.")
                .addUserOption(opt => opt.setName("user").setDescription("The user to check.").setRequired(true))
        )
        .addSubcommand(c =>
            c.setName("clearwarnings").setDescription("Clear all warnings for a member.")
                .addUserOption(opt => opt.setName("user").setDescription("The user to clear warnings for.").setRequired(true))
        ),


    async execute(interaction: ChatInputCommandInteraction<"cached">) {
        const command = interaction.options.getSubcommand();
        if (command === "kick") return await this.kick(interaction);
        if (command === "ban") return await this.ban(interaction);
        if (command === "unban") return await this.unban(interaction);
        if (command === "timeout") return await this.timeout(interaction);
        if (command === "untimeout") return await this.untimeout(interaction);
        if (command === "warn") return await this.warn(interaction);
        if (command === "warnings") return await this.warnings(interaction);
        if (command === "clearwarnings") return await this.clearwarnings(interaction);
    },


    async kick(interaction: ChatInputCommandInteraction<"cached">) {
        const user = interaction.options.getUser("user", true);
        const reason = interaction.options.getString("reason") ?? "No reason provided";
        const member = interaction.guild.members.cache.get(user.id);

        if (!member) return await interaction.reply(Messages.error("That user is not in this server.", {ephemeral: true}));
        if (!member.kickable) return await interaction.reply(Messages.error("I cannot kick that user. They may have a higher role than me.", {ephemeral: true}));

        try {
            await member.kick(reason);
            await logModAction(interaction, "Kicked", user.id, reason);
            await interaction.reply(Messages.success(`Successfully kicked **${user.tag}**.`));
        }
        catch {
            await interaction.reply(Messages.error("Failed to kick that user.", {ephemeral: true}));
        }
    },


    async ban(interaction: ChatInputCommandInteraction<"cached">) {
        const user = interaction.options.getUser("user", true);
        const reason = interaction.options.getString("reason") ?? "No reason provided";
        const deleteDays = interaction.options.getInteger("delete_days") ?? 0;
        const member = interaction.guild.members.cache.get(user.id);

        if (member && !member.bannable) return await interaction.reply(Messages.error("I cannot ban that user. They may have a higher role than me.", {ephemeral: true}));

        try {
            await interaction.guild.bans.create(user.id, {reason, deleteMessageSeconds: deleteDays * 86400});
            await logModAction(interaction, "Banned", user.id, reason);
            await interaction.reply(Messages.success(`Successfully banned **${user.tag}**.`));
        }
        catch {
            await interaction.reply(Messages.error("Failed to ban that user.", {ephemeral: true}));
        }
    },


    async unban(interaction: ChatInputCommandInteraction<"cached">) {
        const userId = interaction.options.getString("user_id", true);
        const reason = interaction.options.getString("reason") ?? "No reason provided";

        try {
            await interaction.guild.bans.remove(userId, reason);
            await logModAction(interaction, "Unbanned", userId, reason);
            await interaction.reply(Messages.success(`Successfully unbanned user with ID **${userId}**.`));
        }
        catch {
            await interaction.reply(Messages.error("Failed to unban that user. They may not be banned.", {ephemeral: true}));
        }
    },


    async timeout(interaction: ChatInputCommandInteraction<"cached">) {
        const user = interaction.options.getUser("user", true);
        const durationMinutes = interaction.options.getInteger("duration", true);
        const reason = interaction.options.getString("reason") ?? "No reason provided";
        const member = interaction.guild.members.cache.get(user.id);

        if (!member) return await interaction.reply(Messages.error("That user is not in this server.", {ephemeral: true}));
        if (!member.moderatable) return await interaction.reply(Messages.error("I cannot timeout that user. They may have a higher role than me.", {ephemeral: true}));

        try {
            await member.timeout(durationMinutes * 60 * 1000, reason);
            await logModAction(interaction, "Timed Out", user.id, `${reason} (Duration: ${durationMinutes}m)`);
            await interaction.reply(Messages.success(`Successfully timed out **${user.tag}** for ${durationMinutes} minute(s).`));
        }
        catch {
            await interaction.reply(Messages.error("Failed to timeout that user.", {ephemeral: true}));
        }
    },


    async untimeout(interaction: ChatInputCommandInteraction<"cached">) {
        const user = interaction.options.getUser("user", true);
        const reason = interaction.options.getString("reason") ?? "No reason provided";
        const member = interaction.guild.members.cache.get(user.id);

        if (!member) return await interaction.reply(Messages.error("That user is not in this server.", {ephemeral: true}));

        try {
            await member.timeout(null, reason);
            await logModAction(interaction, "Timeout Removed", user.id, reason);
            await interaction.reply(Messages.success(`Successfully removed timeout from **${user.tag}**.`));
        }
        catch {
            await interaction.reply(Messages.error("Failed to remove timeout from that user.", {ephemeral: true}));
        }
    },


    async warn(interaction: ChatInputCommandInteraction<"cached">) {
        const user = interaction.options.getUser("user", true);
        const reason = interaction.options.getString("reason", true);
        const key = `${interaction.guild.id}-${user.id}`;
        const current: Warning[] = await warningsDB.get(key) ?? [];

        current.push({reason, moderatorId: interaction.user.id, timestamp: Date.now()});
        await warningsDB.set(key, current);

        await logModAction(interaction, `Warned (${current.length} total)`, user.id, reason);
        await interaction.reply(Messages.success(`Warning issued to **${user.tag}**. They now have **${current.length}** warning(s).`));
    },


    async warnings(interaction: ChatInputCommandInteraction<"cached">) {
        const user = interaction.options.getUser("user", true);
        const key = `${interaction.guild.id}-${user.id}`;
        const current: Warning[] = await warningsDB.get(key) ?? [];

        if (!current.length) return await interaction.reply(Messages.info(`**${user.tag}** has no warnings.`, {ephemeral: true}));

        const description = current
            .map((w, i) => `**${i + 1}.** ${w.reason}\n*by <@${w.moderatorId}> on ${new Date(w.timestamp).toDateString()}*`)
            .join("\n\n");

        const embed = new EmbedBuilder()
            .setColor(Colors.Warn)
            .setTitle(`Warnings for ${user.tag}`)
            .setThumbnail(user.displayAvatarURL())
            .setDescription(description);

        await interaction.reply({embeds: [embed], ephemeral: true});
    },


    async clearwarnings(interaction: ChatInputCommandInteraction<"cached">) {
        const user = interaction.options.getUser("user", true);
        const key = `${interaction.guild.id}-${user.id}`;
        await warningsDB.delete(key);
        await interaction.reply(Messages.success(`Cleared all warnings for **${user.tag}**.`, {ephemeral: true}));
    },
};

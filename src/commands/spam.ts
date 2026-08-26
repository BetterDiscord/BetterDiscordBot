import {ChatInputCommandInteraction, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder} from "discord.js";
import * as notices from "../util/notices";


// TODO: move detectspam from moderation to here
export default {
    data: new SlashCommandBuilder()
        .setName("spam")
        .setDescription("Commands for dealing with spam.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .setContexts(InteractionContextType.Guild)
        .addSubcommand(
            c => c.setName("link").setDescription("Adds a link to the automod spam link filter")
                .addStringOption(opt =>
                    opt.setName("link").setDescription("Link to add to the filter").setRequired(true)
                )
        ),

    async execute(interaction: ChatInputCommandInteraction<"cached">) {
        const command = interaction.options.getSubcommand();
        if (command === "link") return await this.link(interaction);
    },


    async link(interaction: ChatInputCommandInteraction<"cached">) {
        const rule = await interaction.guild.autoModerationRules.fetch("1256935881168781332");
        if (!rule) return await interaction.reply(notices.error("Spam link filter rule not found! Report this to Zerebos!", {ephemeral: true}));

        const existing = rule.triggerMetadata?.keywordFilter ?? [];
        const link = interaction.options.getString("link", true);

        if (existing.includes(link)) return await interaction.reply(notices.info("This link is already in the spam filter!", {ephemeral: true}));

        await rule.edit({
            triggerMetadata: {
                keywordFilter: [...existing, link],
            }
        });

        // Don't make this ephemeral since it's useful to see who added what link
        await interaction.reply(notices.success("Link added to spam filter!"));
    },
};

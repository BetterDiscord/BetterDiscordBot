import {ApplicationCommandOptionType, ApplicationCommandType, ChatInputCommandInteraction, InteractionContextType, PermissionFlagsBits} from "discord.js";
import {defineCommand} from "../framework";
import config from "../config";
import * as notices from "../util/notices";


// TODO: move detectspam from moderation to here
async function addLink(interaction: ChatInputCommandInteraction<"cached">) {
    const rule = await interaction.guild.autoModerationRules.fetch(config.automod.spamLinkRule);
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
}


export const command = defineCommand({
    guildOnly: true,
    data: {
        type: ApplicationCommandType.ChatInput,
        name: "spam",
        description: "Commands for dealing with spam.",
        default_member_permissions: PermissionFlagsBits.ManageMessages.toString(),
        contexts: [InteractionContextType.Guild],
        options: [{
            type: ApplicationCommandOptionType.Subcommand,
            name: "link",
            description: "Adds a link to the automod spam link filter",
            options: [{
                type: ApplicationCommandOptionType.String,
                name: "link",
                description: "Link to add to the filter",
                required: true
            }]
        }]
    },

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === "link") return await addLink(interaction);
    }
});

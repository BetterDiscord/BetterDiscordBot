import {
    ApplicationCommandOptionType, ApplicationCommandType, ApplicationIntegrationType,
    AutocompleteInteraction, ChatInputCommandInteraction, ComponentType, InteractionContextType,
    MessageFlags, type RESTPostAPIChatInputApplicationCommandsJSONBody
} from "discord.js";
import {defineCommand} from "../framework";
import type {AtLeast, Tag} from "../types";
import {tagsDB} from "../db";
import {msInMinute} from "../util/time";
import {tagContainer, updateTagModal} from "../components/tags";
import {error, info, success} from "../util/notices";


const nameOption = (description: string, withAutocomplete: boolean) => ({
    type: ApplicationCommandOptionType.String as const,
    name: "name",
    description,
    required: true,
    autocomplete: withAutocomplete
});

const data: RESTPostAPIChatInputApplicationCommandsJSONBody = {
    type: ApplicationCommandType.ChatInput,
    name: "tag",
    description: "Saving and recalling custom tags.",
    contexts: [InteractionContextType.Guild],
    integration_types: [ApplicationIntegrationType.GuildInstall],
    options: [
        {type: ApplicationCommandOptionType.Subcommand, name: "list", description: "List all tags in this server"},
        {type: ApplicationCommandOptionType.Subcommand, name: "view", description: "View a tag", options: [nameOption("Name of the tag to view", true)]},
        {type: ApplicationCommandOptionType.Subcommand, name: "update", description: "Update a tag", options: [nameOption("Name of the tag to update", true)]},
        {type: ApplicationCommandOptionType.Subcommand, name: "delete", description: "Delete a tag", options: [nameOption("Name of the tag to delete", true)]},
        {type: ApplicationCommandOptionType.Subcommand, name: "create", description: "Create a new tag", options: [nameOption("Name of the tag to create", false)]}
    ]
};


async function view(interaction: ChatInputCommandInteraction<"cached">) {
    await interaction.deferReply();
    const tagName = interaction.options.getString("name", true);
    const guildTags = await tagsDB.get(interaction.guildId) ?? {};
    const tag = guildTags[tagName];
    if (!tag) {
        return await interaction.editReply(error(`Tag with name \`${tagName}\` does not exist.`));
    }

    return await interaction.editReply({
        flags: MessageFlags.IsComponentsV2,
        components: [tagContainer(tag)]
    });
}

async function create(interaction: ChatInputCommandInteraction<"cached">) {
    if (!interaction.memberPermissions.has("ManageMessages")) return await interaction.reply(error("You do not have permission to create tags.", {ephemeral: true}));
    const tagName = interaction.options.getString("name", true);
    const guildTags = await tagsDB.get(interaction.guildId) ?? {};
    const tag = guildTags[tagName];
    if (tag) return await interaction.reply(error(`Tag with name \`${tagName}\` already exists.`, {ephemeral: true}));
    return await showTagModal(interaction, {name: tagName});
}

async function update(interaction: ChatInputCommandInteraction<"cached">) {
    if (!interaction.memberPermissions.has("ManageMessages")) return await interaction.reply(error("You do not have permission to update tags.", {ephemeral: true}));
    const tagName = interaction.options.getString("name", true);
    const guildTags = await tagsDB.get(interaction.guildId) ?? {};
    const tag = guildTags[tagName];
    if (!tag) return await interaction.reply(error(`Tag with name \`${tagName}\` does not exist.`, {ephemeral: true}));
    return await showTagModal(interaction, tag);
}

async function remove(interaction: ChatInputCommandInteraction<"cached">) {
    await interaction.deferReply({flags: MessageFlags.Ephemeral});
    if (!interaction.memberPermissions.has("ManageMessages")) return await interaction.editReply(error("You do not have permission to delete tags."));
    const tagName = interaction.options.getString("name", true);
    const guildTags = await tagsDB.get(interaction.guildId) ?? {};
    const tag = guildTags[tagName];
    if (!tag) {
        return await interaction.editReply(error(`Tag with name \`${tagName}\` does not exist.`));
    }

    delete guildTags[tagName];
    await tagsDB.set(interaction.guildId, guildTags);

    return await interaction.editReply(success(`Tag with name \`${tagName}\` has been deleted.`));
}

async function list(interaction: ChatInputCommandInteraction<"cached">) {
    await interaction.deferReply({flags: MessageFlags.Ephemeral});
    const guildTags = await tagsDB.get(interaction.guildId) ?? {};
    const tagNames = Object.keys(guildTags);
    if (tagNames.length === 0) {
        return await interaction.editReply(info("There are no tags in this server yet."));
    }

    return await interaction.editReply({
        flags: MessageFlags.IsComponentsV2,
        components: [{
            type: ComponentType.Container,
            components: [{
                type: ComponentType.TextDisplay,
                content: `**Tags in this server:**\n${tagNames.map(name => `- \`${name}\``).join("\n")}`
            }]
        }]
    });
}


async function showTagModal(interaction: ChatInputCommandInteraction<"cached">, tag: AtLeast<Tag, "name">) {
    const isUpdating = !!tag.content;

    await interaction.showModal(updateTagModal(tag));

    try {
        const modalInteraction = await interaction.awaitModalSubmit({time: msInMinute * 5});
        const title = modalInteraction.fields.getTextInputValue("title");
        const content = modalInteraction.fields.getTextInputValue("content");
        const thumbnailUrl = modalInteraction.fields.getTextInputValue("thumbnail");

        const guildTags = await tagsDB.get(interaction.guildId) ?? {};
        guildTags[tag.name] = {
            name: tag.name,
            title: title || undefined,
            content,
            thumbnailUrl: thumbnailUrl || undefined,
        };
        await tagsDB.set(interaction.guildId, guildTags);

        await modalInteraction.reply(success(`Tag \`${tag.name}\` has been ${isUpdating ? "updated" : "created"} successfully!`));
    }
    catch {
        await interaction.followUp(error("Modal submission timed out!"));
    }
}


/** Autocomplete for the tag-name option on view / update / delete. */
async function autocomplete(interaction: AutocompleteInteraction<"cached">) {
    const focusedValue = interaction.options.getFocused();

    if (interaction.options.getSubcommand() === "view" || interaction.options.getSubcommand() === "update" || interaction.options.getSubcommand() === "delete") {
        const guildTags = await tagsDB.get(interaction.guildId) ?? {};
        const tags = Object.keys(guildTags);

        const filtered = tags.filter(tag => tag.toLowerCase().startsWith(focusedValue.toLowerCase()));
        const limited = filtered.slice(0, 25);

        return await interaction.respond(
            limited.map(tag => ({name: tag, value: tag}))
        );
    }

    return await interaction.respond([]);
}


export const command = defineCommand({
    guildOnly: true,
    data,

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === "view") return await view(interaction);
        if (subcommand === "create") return await create(interaction);
        if (subcommand === "update") return await update(interaction);
        if (subcommand === "delete") return await remove(interaction);
        if (subcommand === "list") return await list(interaction);

        return await interaction.reply(error("This command is not yet implemented.", {ephemeral: true}));
    },

    autocomplete
});

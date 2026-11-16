import {ApplicationIntegrationType, AutocompleteInteraction, ChatInputCommandInteraction, InteractionContextType, MessageFlags, SlashCommandBuilder} from "discord.js";
import type {AtLeast, Tag} from "../types";
import {tagsDB} from "../db";
import {msInMinute} from "../util/time";
import {TagView, UpdateTagModal} from "../components/tags";
import {Container, Error, Info, Message, Success, TextDisplay} from "../components/ui";


export default {
    data: new SlashCommandBuilder()
        .setName("tag")
        .setDescription("Saving and recalling custom tags.")
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
        .setContexts(InteractionContextType.Guild)
        .addSubcommand(c => c.setName("list").setDescription("List all tags in this server"))
        .addSubcommand(c => c.setName("view").setDescription("View a tag")
            .addStringOption(opt => opt.setName("name").setDescription("Name of the tag to view").setRequired(true).setAutocomplete(true))
        )
        .addSubcommand(c => c.setName("update").setDescription("Update a tag")
            .addStringOption(opt => opt.setName("name").setDescription("Name of the tag to update").setRequired(true).setAutocomplete(true))
        )
        .addSubcommand(c => c.setName("delete").setDescription("Delete a tag")
            .addStringOption(opt => opt.setName("name").setDescription("Name of the tag to delete").setRequired(true).setAutocomplete(true))
        )
        .addSubcommand(c => c.setName("create").setDescription("Create a new tag")
            .addStringOption(opt => opt.setName("name").setDescription("Name of the tag to create").setRequired(true))
        ),

    /**
     * Main function for tag command
     */
    async execute(interaction: ChatInputCommandInteraction<"cached">) {
        const command = interaction.options.getSubcommand();
        if (command === "view") return await this.view(interaction);
        if (command === "create") return await this.create(interaction);
        if (command === "update") return await this.update(interaction);
        if (command === "delete") return await this.delete(interaction);
        if (command === "list") return await this.list(interaction);

        return await interaction.editReply(Error("This command is not yet implemented."));
    },

    async view(interaction: ChatInputCommandInteraction<"cached">) {
        await interaction.deferReply();
        const tagName = interaction.options.getString("name", true);
        const guildTags = await tagsDB.get(interaction.guildId) ?? {};
        const tag = guildTags[tagName];
        if (!tag) {
            return await interaction.editReply(Error(`Tag with name \`${tagName}\` does not exist.`));
        }

        return await interaction.editReply(Message(TagView(tag)));
    },

    // TODO: reconsider which replies in this command should be ephemeral. The errors in `create` and `update` and
    // the modal's success message are visible to the whole channel, while everything in `delete` and `list` is not.
    async create(interaction: ChatInputCommandInteraction<"cached">) {
        if (!interaction.memberPermissions.has("ManageMessages")) return await interaction.reply(Error("You do not have permission to create tags."));
        const tagName = interaction.options.getString("name", true);
        const guildTags = await tagsDB.get(interaction.guildId) ?? {};
        const tag = guildTags[tagName];
        if (tag) return await interaction.reply(Error(`Tag with name \`${tagName}\` already exists.`));
        return await this.showTagModal(interaction, {name: tagName});
    },

    async update(interaction: ChatInputCommandInteraction<"cached">) {
        if (!interaction.memberPermissions.has("ManageMessages")) return await interaction.reply(Error("You do not have permission to update tags."));
        const tagName = interaction.options.getString("name", true);
        const guildTags = await tagsDB.get(interaction.guildId) ?? {};
        const tag = guildTags[tagName];
        if (!tag) return await interaction.reply(Error(`Tag with name \`${tagName}\` does not exist.`));
        return await this.showTagModal(interaction, tag);
    },

    async delete(interaction: ChatInputCommandInteraction<"cached">) {
        await interaction.deferReply({flags: MessageFlags.Ephemeral});
        if (!interaction.memberPermissions.has("ManageMessages")) return await interaction.editReply(Error("You do not have permission to delete tags."));
        const tagName = interaction.options.getString("name", true);
        const guildTags = await tagsDB.get(interaction.guildId) ?? {};
        const tag = guildTags[tagName];
        if (!tag) {
            return await interaction.editReply(Error(`Tag with name \`${tagName}\` does not exist.`));
        }

        delete guildTags[tagName];
        await tagsDB.set(interaction.guildId, guildTags);

        return await interaction.editReply(Success(`Tag with name \`${tagName}\` has been deleted.`));
    },

    async list(interaction: ChatInputCommandInteraction<"cached">) {
        await interaction.deferReply({flags: MessageFlags.Ephemeral});
        const guildTags = await tagsDB.get(interaction.guildId) ?? {};
        const tagNames = Object.keys(guildTags);
        if (tagNames.length === 0) {
            return await interaction.editReply(Info("There are no tags in this server yet."));
        }

        return await interaction.editReply(Message(
            Container(
                TextDisplay(`**Tags in this server:**\n${tagNames.map(name => `- \`${name}\``).join("\n")}`),
            ),
        ));
    },


    async showTagModal(interaction: ChatInputCommandInteraction<"cached">, tag: AtLeast<Tag, "name">) {
        const isUpdating = !!tag.content;

        const customId = `tagmodal-${interaction.id}`;
        await interaction.showModal(UpdateTagModal({...tag, customId}));

        try {
            const modalInteraction = await interaction.awaitModalSubmit({time: msInMinute * 5, filter: i => i.customId === customId});
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

            await modalInteraction.reply(Success(`Tag \`${tag.name}\` has been ${isUpdating ? "updated" : "created"} successfully!`));
        }
        catch {
            await interaction.followUp(Error("Modal submission timed out!"));
        }
    },


    /**
     * Autocomplete handlers for tags
     */
    async autocomplete(interaction: AutocompleteInteraction<"cached">) {
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
    },
};

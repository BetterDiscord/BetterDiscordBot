import {ApplicationIntegrationType, AutocompleteInteraction, ChatInputCommandInteraction, ContainerBuilder, InteractionContextType, MessageFlags, SectionBuilder, SlashCommandBuilder, TextDisplayBuilder, TextDisplayComponent, type ModalComponentData} from "discord.js";
import Messages from "../util/messages";
import type {AtLeast, Tag} from "../types";
import {tagsDB} from "../db";
import {msInMinute} from "../util/time";
import {Tag as TagComponent, UpdateTagModal} from "../components/tags";
import {ComponentMessage, Container, TextDisplay, type MessageOptions} from "@djsx";


export default {
    data: new SlashCommandBuilder()
        .setName("tag")
        .setDescription("Saving and recalling custom tags.")
        .setContexts(InteractionContextType.Guild)
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
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
            .addStringOption(opt => opt.setName("name").setDescription("Name of the tag to create").setRequired(true).setAutocomplete(false))
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

        return await interaction.editReply(Messages.error("This command is not yet implemented."));
    },

    async view(interaction: ChatInputCommandInteraction<"cached">) {
        await interaction.deferReply();
        const tagName = interaction.options.getString("name", true);
        const guildTags = await tagsDB.get(interaction.guildId) ?? {};
        const tag = guildTags[tagName];
        if (!tag) {
            return await interaction.editReply(Messages.error(`Tag with name \`${tagName}\` does not exist.`));
        }

        return await interaction.editReply(
            (<ComponentMessage>
                <TagComponent {...tag} />
            </ComponentMessage>) as MessageOptions
        );
    },

    async create(interaction: ChatInputCommandInteraction<"cached">) {
        if (!interaction.memberPermissions.has("ManageMessages")) return await interaction.editReply(Messages.error("You do not have permission to create tags.", {ephemeral: true}));
        const tagName = interaction.options.getString("name", true);
        const guildTags = await tagsDB.get(interaction.guildId) ?? {};
        const tag = guildTags[tagName];
        if (tag) return await interaction.editReply(Messages.error(`Tag with name \`${tagName}\` already exists.`, {ephemeral: true}));

        return await this.showTagModal(interaction, {name: tagName});
    },

    async update(interaction: ChatInputCommandInteraction<"cached">) {
        if (!interaction.memberPermissions.has("ManageMessages")) return await interaction.editReply(Messages.error("You do not have permission to update tags.", {ephemeral: true}));
        const tagName = interaction.options.getString("name", true);
        const guildTags = await tagsDB.get(interaction.guildId) ?? {};
        const tag = guildTags[tagName];
        if (!tag) return await interaction.editReply(Messages.error(`Tag with name \`${tagName}\` does not exist.`, {ephemeral: true}));

        return await this.showTagModal(interaction, tag);
    },

    async delete(interaction: ChatInputCommandInteraction<"cached">) {
        if (!interaction.memberPermissions.has("ManageMessages")) return await interaction.editReply(Messages.error("You do not have permission to delete tags.", {ephemeral: true}));
        await interaction.deferReply({flags: MessageFlags.Ephemeral});
        const tagName = interaction.options.getString("name", true);
        const guildTags = await tagsDB.get(interaction.guildId) ?? {};
        const tag = guildTags[tagName];
        if (!tag) {
            return await interaction.editReply(Messages.error(`Tag with name \`${tagName}\` does not exist.`, {ephemeral: true}));
        }

        delete guildTags[tagName];
        await tagsDB.set(interaction.guildId, guildTags);

        return await interaction.editReply(Messages.success(`Tag with name \`${tagName}\` has been deleted.`, {ephemeral: true}));
    },

    async list(interaction: ChatInputCommandInteraction<"cached">) {
        await interaction.deferReply({flags: MessageFlags.Ephemeral});
        const guildTags = await tagsDB.get(interaction.guildId) ?? {};
        const tagNames = Object.keys(guildTags);
        if (tagNames.length === 0) {
            return await interaction.editReply(Messages.info("There are no tags in this server yet.", {ephemeral: true}));
        }

        return await interaction.editReply(
            <ComponentMessage>
                <Container>
                    <TextDisplay>{`**Tags in this server:**\n${tagNames.map(name => `- \`${name}\``).join("\n")}`}</TextDisplay>
                </Container>
            </ComponentMessage> as MessageOptions
        );
    },


    async showTagModal(interaction: ChatInputCommandInteraction<"cached">, tag: AtLeast<Tag, "name">) {
        const isUpdating = !!tag.content;

        await interaction.showModal(<UpdateTagModal {...tag} /> as ModalComponentData);

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

            await modalInteraction.reply(Messages.success(`Tag \`${tag.name}\` has been ${isUpdating ? "updated" : "created"} successfully!`, {ephemeral: true}));
        }
        catch {
            await interaction.followUp(Messages.error("Modal submission timed out!", {ephemeral: true}));
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


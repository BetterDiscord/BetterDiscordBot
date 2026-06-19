import {AutocompleteInteraction, ChatInputCommandInteraction, MessageFlags, type ModalComponentData} from "discord.js";
import type {AtLeast, Tag} from "../types";
import {tagsDB} from "../db";
import {msInMinute} from "../util/time";
import {Tag as TagComponent, UpdateTagModal} from "../components/tags";
import {ComponentMessage, Container, TextDisplay, type MessageOptions} from "@djsx";
import {Error, Info, Success} from "@djsx/widgets/Messages";
import {SlashCommand, StringOption, Subcommand} from "@djsx/commands/Command";


export default {
    data: <SlashCommand name="tag" description="Saving and recalling custom tags." guildInstall guildContext>
        <Subcommand name="list" description="List all tags in this server" />
        <Subcommand name="view" description="View a tag">
            <StringOption name="name" description="Name of the tag to view" required autocomplete />
        </Subcommand>
        <Subcommand name="update" description="Update a tag">
            <StringOption name="name" description="Name of the tag to update" required autocomplete />
        </Subcommand>
        <Subcommand name="delete" description="Delete a tag">
            <StringOption name="name" description="Name of the tag to delete" required autocomplete />
        </Subcommand>
        <Subcommand name="create" description="Create a new tag">
            <StringOption name="name" description="Name of the tag to create" required autocomplete={false} />
        </Subcommand>
    </SlashCommand>,

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

        return await interaction.editReply(<Error>This command is not yet implemented.</Error> as MessageOptions);
    },

    async view(interaction: ChatInputCommandInteraction<"cached">) {
        await interaction.deferReply();
        const tagName = interaction.options.getString("name", true);
        const guildTags = await tagsDB.get(interaction.guildId) ?? {};
        const tag = guildTags[tagName];
        if (!tag) {
            return await interaction.editReply(<Error>Tag with name `{tagName}` does not exist.</Error> as MessageOptions);
        }

        return await interaction.editReply(
            (<ComponentMessage>
                <TagComponent {...tag} />
            </ComponentMessage>) as MessageOptions
        );
    },

    async create(interaction: ChatInputCommandInteraction<"cached">) {
        if (!interaction.memberPermissions.has("ManageMessages")) return await interaction.editReply(<Error>You do not have permission to create tags.</Error> as MessageOptions);
        const tagName = interaction.options.getString("name", true);
        const guildTags = await tagsDB.get(interaction.guildId) ?? {};
        const tag = guildTags[tagName];
        if (tag) return await interaction.editReply(<Error>Tag with name `{tagName}` already exists.</Error> as MessageOptions);
        return await this.showTagModal(interaction, {name: tagName});
    },

    async update(interaction: ChatInputCommandInteraction<"cached">) {
        if (!interaction.memberPermissions.has("ManageMessages")) return await interaction.editReply(<Error>You do not have permission to update tags.</Error> as MessageOptions);
        const tagName = interaction.options.getString("name", true);
        const guildTags = await tagsDB.get(interaction.guildId) ?? {};
        const tag = guildTags[tagName];
        if (!tag) return await interaction.editReply(<Error>Tag with name `{tagName}` does not exist.</Error> as MessageOptions);
        return await this.showTagModal(interaction, tag);
    },

    async delete(interaction: ChatInputCommandInteraction<"cached">) {
        if (!interaction.memberPermissions.has("ManageMessages")) return await interaction.editReply(<Error>You do not have permission to delete tags.</Error> as MessageOptions);
        await interaction.deferReply({flags: MessageFlags.Ephemeral});
        const tagName = interaction.options.getString("name", true);
        const guildTags = await tagsDB.get(interaction.guildId) ?? {};
        const tag = guildTags[tagName];
        if (!tag) {
            return await interaction.editReply(<Error>Tag with name `{tagName}` does not exist.</Error> as MessageOptions);
        }

        delete guildTags[tagName];
        await tagsDB.set(interaction.guildId, guildTags);

        return await interaction.editReply(<Success>Tag with name `{tagName}` has been deleted.</Success> as MessageOptions);
    },

    async list(interaction: ChatInputCommandInteraction<"cached">) {
        await interaction.deferReply({flags: MessageFlags.Ephemeral});
        const guildTags = await tagsDB.get(interaction.guildId) ?? {};
        const tagNames = Object.keys(guildTags);
        if (tagNames.length === 0) {
            return await interaction.editReply(<Info>There are no tags in this server yet.</Info> as MessageOptions);
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

            await modalInteraction.reply(<Success>Tag `{tag.name}` has been ${isUpdating ? "updated" : "created"} successfully!</Success> as MessageOptions);
        }
        catch {
            await interaction.followUp(<Error>Modal submission timed out!</Error> as MessageOptions);
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


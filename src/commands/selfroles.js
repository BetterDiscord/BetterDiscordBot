const {SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, RoleSelectMenuBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder} = require("discord.js");
const path = require("path");
const Keyv = require("keyv");
const Colors = require("../util/colors");
const settings = new Keyv("sqlite://" + path.resolve(__dirname, "..", "..", "settings.sqlite3"), {namespace: "selfroles"});


module.exports = {
    data: new SlashCommandBuilder()
        .setName("selfroles")
        .setDescription("Allows users to self-assign roles.")
        .setDMPermission(false),

    /** 
     * @param interaction {import("discord.js").CommandInteraction}
     */
    async execute(interaction) {
        const selfroles = await settings.get(interaction.guild.id) ?? [];
        const listingEmbed = new EmbedBuilder()
            .setColor(Colors.Info)
            .setTitle("Available Roles")
            .setDescription(selfroles.length ? selfroles.map(r => `- <@&${r}>`).join("\n") : "No roles have been configured by the admins.");

        const controls = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("selfroles-user").setLabel("Manage Your Roles").setStyle(ButtonStyle.Success)
        );
        const member = interaction.guild.members.cache.get(interaction.user.id);
        if (member.permissions.has(PermissionFlagsBits.ManageRoles)) {
            controls.addComponents(
                new ButtonBuilder().setCustomId("selfroles-admin").setLabel("Set Assignable Roles").setStyle(ButtonStyle.Primary)
            );
        }

        if (!interaction.replied) return await interaction.reply({embeds: [listingEmbed], components: [controls], ephemeral: true});
        await interaction.editReply({embeds: [listingEmbed], components: [controls]});
    },


    /** 
     * @param interaction {import("discord.js").ButtonInteraction}
     */
    async button(interaction) {
        const id = interaction.customId.split("-")[1];
        if (id === "user") return await this.buttonUser(interaction);
        if (id === "admin") return await this.buttonAdmin(interaction);
    },


    /** 
     * @param interaction {import("discord.js").ButtonInteraction}
     */
    async buttonUser(interaction) {
        const member = interaction.guild.members.cache.get(interaction.user.id);
        const assignable = await settings.get(interaction.guild.id);
        const controls = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId("selfroles")
            .setMinValues(0)
            .setMaxValues(assignable.length)
            .setOptions(assignable.map(
                roleId => new StringSelectMenuOptionBuilder()
                    .setLabel(interaction.guild.roles.cache.get(roleId).name)
                    .setValue(roleId)
                    .setDefault(member.roles.cache.has(roleId))
            ))
        );
        await interaction.update({
            embeds: [new EmbedBuilder().setColor(Colors.Info).setDescription("Please select which roles you want.")],
            components: [controls]
        });
    },


    /** 
     * @param interaction {import("discord.js").StringSelectMenuInteraction}
     */
    async select(interaction) {
        const member = interaction.guild.members.cache.get(interaction.user.id);
        const assignable = await settings.get(interaction.guild.id);
        try {
            if (assignable.length) await member.roles.remove(assignable);
            if (interaction.values.length) await member.roles.add(interaction.values);
            await interaction.update({embeds: [new EmbedBuilder().setColor(Colors.Success).setDescription("Successfully assigned your roles!")], components: []});
        }
        catch {
            await interaction.update({embeds: [new EmbedBuilder().setColor(Colors.Error).setDescription("Could not assign your roles. It may be a permission issue.")]});
        }

        // Restart the flow
        await new Promise(r => setTimeout(r, 3000));
        await this.execute(interaction);
    },


    /** 
     * @param interaction {import("discord.js").ButtonInteraction}
     */
    async buttonAdmin(interaction) {
        const defaultRoles = await settings.get(interaction.guild.id) ?? [];
        const controls = new ActionRowBuilder().addComponents(
            new RoleSelectMenuBuilder().setCustomId("selfroles").setMaxValues(25).setDefaultRoles(defaultRoles)
        );
        await interaction.update({
            embeds: [new EmbedBuilder().setColor(Colors.Info).setDescription("Please select which roles should be self-assignable.")],
            components: [controls],
        });
    },


    /** 
     * @param interaction {import("discord.js").RoleSelectMenuInteraction}
     */
    async role(interaction) {
        await settings.set(interaction.guild.id, [...interaction.roles.keys()]);
        await interaction.update({embeds: [new EmbedBuilder().setColor(Colors.Success).setDescription("Self-assignable roles set successfully.")], components: []});

        // Restart the flow
        await new Promise(r => setTimeout(r, 3000));
        await this.execute(interaction);
    },
};

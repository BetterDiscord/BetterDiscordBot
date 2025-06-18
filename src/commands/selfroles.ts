import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, MessageComponentInteraction, PermissionFlagsBits, RoleSelectMenuBuilder, RoleSelectMenuInteraction, SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuInteraction, StringSelectMenuOptionBuilder} from "discord.js";
import {selfrolesDB} from "../db";
import Messages from "../util/messages";
import Colors from "../util/colors";



export default {
    data: new SlashCommandBuilder()
        .setName("selfroles")
        .setDescription("Allows users to self-assign roles.")
        .setDMPermission(false),


    async execute(interaction: MessageComponentInteraction<"cached">) {
        const selfroles = await selfrolesDB.get(interaction.guild.id) ?? [];
        const listingEmbed = new EmbedBuilder().setColor(Colors.Info).setTitle("Available Roles")
            .setDescription(selfroles.length ? selfroles.map((r: string) => `- <@&${r}>`).join("\n") : "No roles have been configured by the admins.");

        const controls = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId("selfroles-user").setLabel("Manage Your Roles").setStyle(ButtonStyle.Success)
        );
        const member = interaction.guild.members.cache.get(interaction.user.id)!;
        if (member.permissions.has(PermissionFlagsBits.ManageRoles)) {
            controls.addComponents(
                new ButtonBuilder().setCustomId("selfroles-admin").setLabel("Set Assignable Roles").setStyle(ButtonStyle.Primary)
            );
        }

        if (!interaction.replied) return await interaction.reply({embeds: [listingEmbed], components: [controls], ephemeral: true});
        await interaction.editReply({embeds: [listingEmbed], components: [controls]});
    },


    async button(interaction: ButtonInteraction<"cached">) {
        const id = interaction.customId.split("-")[1];
        if (id === "user") return await this.buttonUser(interaction);
        if (id === "admin") return await this.buttonAdmin(interaction);
    },


    async buttonUser(interaction: ButtonInteraction<"cached">) {
        const member = interaction.guild.members.cache.get(interaction.user.id)!;
        const assignable = await selfrolesDB.get(interaction.guild.id);
        const controls = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder().setCustomId("selfroles")
            .setMinValues(0)
            .setMaxValues(assignable.length)
            .setOptions(assignable.map(
                (roleId: string) => new StringSelectMenuOptionBuilder()
                    .setLabel(interaction.guild.roles.cache.get(roleId)!.name)
                    .setValue(roleId)
                    .setDefault(member.roles.cache.has(roleId))
            ))
        );

        await interaction.update(Messages.info("Please select which roles you want.", {components: [controls]}));
    },


    async select(interaction: StringSelectMenuInteraction<"cached">) {
        const member = interaction.guild.members.cache.get(interaction.user.id)!;
        const assignable = await selfrolesDB.get(interaction.guild.id);
        try {
            if (assignable.length) await member.roles.remove(assignable);
            if (interaction.values.length) await member.roles.add(interaction.values);
            await interaction.update(Messages.success("Successfully assigned your roles!", {components: []}));
        }
        catch {
            await interaction.update(Messages.error("Could not assign your roles. It may be a permission issue."));
        }

        // Restart the flow
        await new Promise(r => setTimeout(r, 3000));
        await this.execute(interaction);
    },


    async buttonAdmin(interaction: ButtonInteraction<"cached">) {
        const defaultRoles = await selfrolesDB.get(interaction.guild.id) ?? [];
        const controls = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
            new RoleSelectMenuBuilder().setCustomId("selfroles").setMaxValues(25).setDefaultRoles(defaultRoles)
        );
        await interaction.update(Messages.info("Please select which roles should be self-assignable.", {components: [controls]}));
    },


    async role(interaction: RoleSelectMenuInteraction<"cached">) {
        await selfrolesDB.set(interaction.guild.id, [...interaction.roles.keys()]);
        await interaction.update(Messages.success("Self-assignable roles set successfully.", {components: []}));

        // Restart the flow
        await new Promise(r => setTimeout(r, 3000));
        await this.execute(interaction);
    },
};

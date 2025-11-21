import {ActionRowBuilder, ChatInputCommandInteraction, ComponentType, EmbedBuilder, PermissionFlagsBits, RoleSelectMenuBuilder, RoleSelectMenuInteraction, SlashCommandBuilder} from "discord.js";
import {humanReadableUptime} from "../util/time";
import Colors from "../util/colors";
import Messages from "../util/messages";
import {guildDB} from "../db";



const weirdCharsRegex = /[^A-Za-z0-9\-_\\. ]/g;

export default {
    data: new SlashCommandBuilder()
        .setName("cleanname")
        .setDescription("Cleans member display names to match Discord's username standards.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand(
            c => c.setName("join").setDescription("Toggles automatically cleaning new members when they join.")
                .addBooleanOption((/** @type {import("@discordjs/builders").SlashCommandBooleanOption} */ option) =>
                    option.setName("enabled")
                        .setDescription("Whether members should have their display name cleaned upon joining.")
                        .setRequired(true)))
        .addSubcommand(
            c => c.setName("user").setDescription("Fixes a display name for a single user.")
                .addUserOption((/** @type {import("@discordjs/builders").SlashCommandUserOption} */ option) =>
                    option.setName("user")
                        .setDescription("Whose display name should be cleaned?")
                        .setRequired(true)))
        .addSubcommand(c => c.setName("server").setDescription("Fixes all display names in the server.")),


    async execute(interaction: ChatInputCommandInteraction<"cached">) {
        const command = interaction.options.getSubcommand();
        if (command === "server") return await this.server(interaction);
        if (command === "user") return await this.user(interaction);
        if (command === "join") return await this.join(interaction);
    },


    async server(interaction: ChatInputCommandInteraction<"cached">) {
        const controls = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
            new RoleSelectMenuBuilder({type: ComponentType.RoleSelect}).setCustomId("cleanname").setMinValues(0).setMaxValues(25).setDefaultRoles(interaction.guild.roles.highest.id)
        );
        await interaction.reply(Messages.info("Please select which roles should bypass this cleaning.", {components: [controls]}));
    },


    async role(interaction: RoleSelectMenuInteraction<"cached">) {
        const roleIds = [...interaction.roles.keys()];

        const start = Date.now();

        const infoEmbed = new EmbedBuilder();
        infoEmbed.setColor(Colors.Info);
        infoEmbed.setTitle("Fixing Display Names");
        infoEmbed.setDescription(`This will take approximately ${humanReadableUptime(interaction.guild.memberCount * 10)}. Please be patient.`);
        infoEmbed.setFooter({text: "Started at"});
        infoEmbed.setTimestamp(start);
        infoEmbed.setFields(
            {name: "Members", value: interaction.guild.memberCount.toString(), inline: true},
            {name: "Fixed", value: "0", inline: true},
            {name: "Failed", value: "0", inline: true},
        );

        await interaction.update({embeds: [infoEmbed], components: []});

        let changed = 0;
        let failed = 0;
        await interaction.guild.members.fetch();
        const members = interaction.guild.members.cache;
        for (const [, member] of members) {
            // If their name is fine continue
            if (!weirdCharsRegex.test(member.displayName)) continue;

            // If they have a role that was selected as a bypass role, continue
            if (member.roles.cache.hasAny(...roleIds)) continue;

            try {
                await member.setNickname(member.user.username);
                changed++;
            }
            catch {
                // TODO: keep a log
                failed++;
            }
        }

        const finish = Date.now();

        infoEmbed.setFields(
            {name: "Members", value: members.size.toString(), inline: true},
            {name: "Fixed", value: changed.toString(), inline: true},
            {name: "Failed", value: failed.toString(), inline: true},
        );

        infoEmbed.setDescription(`Operation took ${humanReadableUptime(finish - start)}. Thank you for waiting.`);
        infoEmbed.setColor(Colors.Success);
        infoEmbed.setFooter({text: "Completed at"});
        infoEmbed.setTimestamp(finish);

        await interaction.update({embeds: [infoEmbed]});
    },


    async user(interaction: ChatInputCommandInteraction<"cached">) {
        const targetUser = interaction.options.getUser("user", true);
        const member = interaction.guild.members.cache.get(targetUser.id);
        if (!member) return await interaction.reply(Messages.error("This user is not in the server.", {ephemeral: true}));
        const isClean = !weirdCharsRegex.test(member.displayName);
        if (isClean) return await interaction.reply(Messages.info("This member's display name already conforms to the username standards."));
        try {
            await member.setNickname(member.user.username);
            await interaction.reply(Messages.success("Successfully cleaned this member's display name."));
        }
        catch {
            await interaction.reply(Messages.error("Could not clean this member's display name. Double check that I have permission to do so."));
        }
    },


    async join(interaction: ChatInputCommandInteraction<"cached">) {
        const toEnable = !!interaction.options.getBoolean("enabled");
        const guildSettings = await guildDB.get(interaction.guild.id) ?? {};
        const current = guildSettings.cleanOnJoin;
        if (current === toEnable) return await interaction.reply(Messages.info(`This setting was already ${current ? "enabled" : "disabled"}.`));
        guildSettings.cleanOnJoin = toEnable;
        await guildDB.set(interaction.guild.id, guildSettings);
        await interaction.reply(Messages.success(`This setting is now ${toEnable ? "enabled" : "disabled"}.`));
    },
};

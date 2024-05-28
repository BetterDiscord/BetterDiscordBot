const {SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder} = require("discord.js");
const {humanReadableUptime} = require("../util/time");
const path = require("path");
const Keyv = require("keyv");
const Colors = require("../util/colors");
const Messages = require("../util/messages");
const settings = new Keyv("sqlite://" + path.resolve(__dirname, "..", "..", "settings.sqlite3"), {namespace: "settings"});


const weirdCharsRegex = /[^A-Za-z0-9\-_\\. ]/g;

module.exports = {
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
        // .setType(ApplicationCommandType.User),

    /** 
     * @param interaction {import("discord.js").CommandInteraction}
     */
    async execute(interaction) {
        const command = interaction.options.getSubcommand();
        if (command === "server") return await this.server(interaction);
        if (command === "user") return await this.user(interaction);
        if (command === "join") return await this.join(interaction);
    },


    // TODO: remove owner check and add intermediate that allow multi-select role dropdown for ignoring
    /** 
     * @param interaction {import("discord.js").ChatInputCommandInteraction}
     */
    async server(interaction) {
        if (interaction.user.id !== process.env.BOT_OWNER_ID) return await interaction.reply(Messages.error("Sorry this command is only usable by the owner!", {ephemeral: true}));
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

        await interaction.reply({embeds: [infoEmbed]});

        let changed = 0;
        let failed = 0;
        await interaction.guild.members.fetch();
        const members = interaction.guild.members.cache;
        for (const [, member] of members) {
            if (!weirdCharsRegex.test(member.displayName)) continue;

            try {
                //await member.setNickname(member.user.username);
                console.log(member.displayName);
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

        await interaction.editReply({embeds: [infoEmbed]});
    },


    /** 
     * @param interaction {import("discord.js").ChatInputCommandInteraction}
     */
    async user(interaction) {
        const targetUser = interaction.options.getUser("user");
        const member = interaction.guild.members.cache.get(targetUser.id);
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


    /** 
     * @param interaction {import("discord.js").ChatInputCommandInteraction}
     */
    async join(interaction) {
        const toEnable = interaction.options.getBoolean("enabled");
        const guildSettings = await settings.get(interaction.guild.id) ?? {};
        const current = guildSettings.cleanOnJoin;
        if (current === toEnable) return await interaction.reply(Messages.info(`This setting was already ${current ? "enabled" : "disabled"}.`));
        guildSettings.cleanOnJoin = toEnable;
        await settings.set(interaction.guild.id, guildSettings);
        await interaction.reply(Messages.success(`This setting is now ${toEnable ? "enabled" : "disabled"}.`));
    },
};

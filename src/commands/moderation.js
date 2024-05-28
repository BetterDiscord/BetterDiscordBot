const {SlashCommandBuilder, PermissionFlagsBits} = require("discord.js");
const path = require("path");
const Keyv = require("keyv");
const Messages = require("../util/messages");
const settings = new Keyv("sqlite://" + path.resolve(__dirname, "..", "..", "settings.sqlite3"), {namespace: "settings"});


module.exports = {
    data: new SlashCommandBuilder()
        .setName("moderation")
        .setDescription("Commands for moderating the server.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand(
            c => c.setName("invitefilter").setDescription("Toggles the invite filter module.")
                .addBooleanOption(opt =>
                    opt.setName("enable").setDescription("Enable or disable").setRequired(false)
                )
        )
        .addSubcommand(
            c => c.setName("modlog").setDescription("Sets a channel to log bot moderation actions.")
                .addChannelOption(opt =>
                    opt.setName("channel").setDescription("Where to log my actions?").setRequired(false)
                )
        )
        .addSubcommand(
            c => c.setName("detectspam").setDescription("Toggles the spam detection module.")
                .addBooleanOption(opt =>
                    opt.setName("enable").setDescription("Enable or disable").setRequired(false)
                )
        ),

    /** 
     * @param {import("discord.js").ChatInputCommandInteraction} interaction
     */
    async execute(interaction) {
        const command = interaction.options.getSubcommand();
        if (command === "invitefilter") return await this.invitefilter(interaction);
        if (command === "detectspam") return await this.detectspam(interaction);
        if (command === "modlog") return await this.modlog(interaction);
    },


    /** 
     * TODO: de-dup with detectspam
     * @param {import("discord.js").ChatInputCommandInteraction} interaction
     */
    async invitefilter(interaction) {
        const toEnable = interaction.options.getBoolean("enable");
        const current = await settings.get(interaction.guild.id) ?? {};
        if (typeof(toEnable) === "undefined") return await interaction.reply(Messages.info(`This module is currently ${current.invitefilter ? "enabled" : "disabled"}.`, {ephemeral: true}));

        current.invitefilter = toEnable;
        await settings.set(interaction.guild.id, current);

        await interaction.reply(Messages.success(`This module has been ${toEnable ? "enabled" : "disabled"}.`, {ephemeral: true}));
    },


    /** 
     * @param {import("discord.js").ChatInputCommandInteraction} interaction
     */
    async detectspam(interaction) {
        const toEnable = interaction.options.getBoolean("enable");
        const current = await settings.get(interaction.guild.id) ?? {};
        if (typeof(toEnable) === "undefined") return await interaction.reply(Messages.info(`This module is currently ${current.detectspam ? "enabled" : "disabled"}.`, {ephemeral: true}));

        current.detectspam = toEnable;
        await settings.set(interaction.guild.id, current);

        await interaction.reply(Messages.success(`This module has been ${toEnable ? "enabled" : "disabled"}.`, {ephemeral: true}));
    },


    /** 
     * @param {import("discord.js").ChatInputCommandInteraction} interaction
     */
    async modlog(interaction) {
        const targetChannel = interaction.options.getChannel("channel");
        const current = await settings.get(interaction.guild.id) ?? {};
        if (targetChannel) {
            current.modlog = targetChannel.id;
            await settings.set(interaction.guild.id, current);
        }
        else {
            delete current.modlog;
            await settings.set(interaction.guild.id, current);
        }
        await interaction.reply(Messages.success(targetChannel ? `Modlog set to <#${targetChannel.id}>!` : "Modlog has been unset!", {ephemeral: true}));
    },
};

import {ChannelType, ChatInputCommandInteraction, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder} from "discord.js";
import {guildDB} from "../db";
import Messages from "../util/messages";
import {getScamImageStats} from "../util/scamimages";



export default {
    data: new SlashCommandBuilder()
        .setName("moderation")
        .setDescription("Commands for moderating the server.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setContexts(InteractionContextType.Guild)
        .addSubcommand(
            c => c.setName("invitefilter").setDescription("Toggles the invite filter module.")
                .addBooleanOption(opt =>
                    opt.setName("enable").setDescription("Enable or disable").setRequired(false)
                )
        )
        .addSubcommand(
            c => c.setName("detectspam").setDescription("Toggles the spam detection module.")
                .addBooleanOption(opt =>
                    opt.setName("enable").setDescription("Enable or disable").setRequired(false)
                )
        )
        .addSubcommand(
            c => c.setName("modlog").setDescription("Sets a channel to log bot moderation actions.")
                .addChannelOption(opt =>
                    opt.setName("channel").setDescription("Where to log my actions?").setRequired(false)
                        .addChannelTypes(ChannelType.GuildText)
                )
        )
        .addSubcommand(
            c => c.setName("joinleave").setDescription("Sets a channel to log join/leave messages.")
                .addChannelOption(opt =>
                    opt.setName("channel").setDescription("Where to log join/leave messages?").setRequired(false)
                        .addChannelTypes(ChannelType.GuildText)
                )
        )
        .addSubcommand(
            c => c.setName("scamimages").setDescription("Sets whether images are checked for the crypto scam.")
                .addStringOption(opt =>
                    opt.setName("mode").setDescription("What to do when a scam image is found").setRequired(false)
                        .addChoices(
                            {name: "Off", value: "off"},
                            {name: "Log only", value: "log"},
                            {name: "Remove and time out", value: "enforce"},
                        )
                )
        ),

    async execute(interaction: ChatInputCommandInteraction<"cached">) {
        const command = interaction.options.getSubcommand();
        if (command === "invitefilter") return await this.invitefilter(interaction);
        if (command === "detectspam") return await this.detectspam(interaction);
        if (command === "modlog") return await this.modlog(interaction);
        if (command === "joinleave") return await this.joinleave(interaction);
        if (command === "scamimages") return await this.scamimages(interaction);
    },


    /**
     * TODO: de-dup with detectspam
     */
    async invitefilter(interaction: ChatInputCommandInteraction<"cached">) {
        const toEnable = interaction.options.getBoolean("enable");
        const current = await guildDB.get(interaction.guild.id) ?? {};
        if (toEnable === null) return await interaction.reply(Messages.info(`This module is currently ${current.invitefilter ? "enabled" : "disabled"}.`, {ephemeral: true}));

        current.invitefilter = toEnable;
        await guildDB.set(interaction.guild.id, current);

        await interaction.reply(Messages.success(`This module has been ${toEnable ? "enabled" : "disabled"}.`, {ephemeral: true}));
    },


    // TODO: move this to spam.ts
    async detectspam(interaction: ChatInputCommandInteraction<"cached">) {
        const toEnable = interaction.options.getBoolean("enable");
        const current = await guildDB.get(interaction.guild.id) ?? {};
        if (toEnable === null) return await interaction.reply(Messages.info(`This module is currently ${current.detectspam ? "enabled" : "disabled"}.`, {ephemeral: true}));

        current.detectspam = toEnable;
        await guildDB.set(interaction.guild.id, current);

        await interaction.reply(Messages.success(`This module has been ${toEnable ? "enabled" : "disabled"}.`, {ephemeral: true}));
    },


    /**
     * TODO: de-dup with joinleave
     */
    async modlog(interaction: ChatInputCommandInteraction<"cached">) {
        const targetChannel = interaction.options.getChannel("channel");
        const current = await guildDB.get(interaction.guild.id) ?? {};
        if (targetChannel) {
            current.modlog = targetChannel.id;
            await guildDB.set(interaction.guild.id, current);
        }
        else {
            delete current.modlog;
            await guildDB.set(interaction.guild.id, current);
        }
        await interaction.reply(Messages.success(targetChannel ? `Modlog set to <#${targetChannel.id}>!` : "Modlog has been unset!", {ephemeral: true}));
    },


    async joinleave(interaction: ChatInputCommandInteraction<"cached">) {
        const targetChannel = interaction.options.getChannel("channel");
        const current = await guildDB.get(interaction.guild.id) ?? {};
        if (targetChannel) {
            current.joinleave = targetChannel.id;
            await guildDB.set(interaction.guild.id, current);
        }
        else {
            delete current.joinleave;
            await guildDB.set(interaction.guild.id, current);
        }
        await interaction.reply(Messages.success(targetChannel ? `Join/leave set to <#${targetChannel.id}>!` : "Join/leave has been unset!", {ephemeral: true}));
    },


    async scamimages(interaction: ChatInputCommandInteraction<"cached">) {
        const mode = interaction.options.getString("mode") as "off" | "log" | "enforce" | null;
        const current = await guildDB.get(interaction.guild.id) ?? {};

        if (mode === null) {
            const stats = await getScamImageStats(interaction.guild.id);
            const lines = [
                `Scam image detection is currently **${current.scamimages ?? "off"}**.`,
                "",
                `Images scanned: ${stats.imagesScanned.toLocaleString()}`,
                `Messages flagged: ${stats.messagesFlagged.toLocaleString()}`,
                `Longest wait for a worker: ${stats.longestWait.toLocaleString()} ms`,
            ];
            return await interaction.reply(Messages.info(lines.join("\n"), {ephemeral: true}));
        }

        if (mode === "off") delete current.scamimages;
        else current.scamimages = mode;
        await guildDB.set(interaction.guild.id, current);

        const outcomes = {
            off: "Images are no longer checked for the crypto scam.",
            log: "Scam images will be reported to the modlog, and nothing else will happen.",
            enforce: "Scam images will be removed and their authors timed out.",
        };
        await interaction.reply(Messages.success(outcomes[mode], {ephemeral: true}));
    },
};

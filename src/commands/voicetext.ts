import {ChannelType, ChatInputCommandInteraction, GuildChannel, OverwriteType, PermissionFlagsBits, SlashCommandBuilder} from "discord.js";
import {voicetextDB} from "../db";
import Messages from "../util/messages";


export default {
    data: new SlashCommandBuilder()
        .setName("voicetext")
        .setDescription("Binds one voice and one text channel together.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand(
            c => c.setName("status").setDescription("Checks the bound status of a voice channel.")
                .addChannelOption(opt =>
                    opt.setName("channel").setRequired(true)
                    .setDescription("Which voice channel to check?")
                    .addChannelTypes(ChannelType.GuildVoice)
                )
        )
        .addSubcommand(
            c => c.setName("unbind").setDescription("Unbinds a voice channel from it's partner.")
                .addChannelOption(opt =>
                    opt.setName("channel").setRequired(true)
                    .setDescription("Which voice channel to unbind?")
                    .addChannelTypes(ChannelType.GuildVoice)
                )
        )
        .addSubcommand(
            c => c.setName("bind").setDescription("Binds a voice and text channel together.")
                .addChannelOption(opt =>
                    opt.setName("voice").setRequired(true)
                    .setDescription("Which voice channel to bind?")
                    .addChannelTypes(ChannelType.GuildVoice)
                )
                .addChannelOption(opt =>
                    opt.setName("text").setRequired(true)
                    .setDescription("Which text channel to bind with?")
                    .addChannelTypes(ChannelType.GuildText)
                )
        ),

    async execute(interaction: ChatInputCommandInteraction<"cached">) {
        const command = interaction.options.getSubcommand();
        if (command === "bind") return await this.bind(interaction);
        if (command === "unbind") return await this.unbind(interaction);
        if (command === "status") return await this.status(interaction);
    },


    async bind(interaction: ChatInputCommandInteraction<"cached">) {
        const voice = interaction.options.getChannel("voice", true);
        const text = interaction.options.getChannel<ChannelType.GuildText>("text", true);
        if (voice.type !== ChannelType.GuildVoice) return await interaction.reply(Messages.error("The voice channel must be a voice channel.", {ephemeral: true}));
        if (text.type !== ChannelType.GuildText) return await interaction.reply(Messages.error("The text channel must be a text channel.", {ephemeral: true}));

        const partner = await voicetextDB.get(voice.id) ?? "";
        if (partner) return await interaction.reply(Messages.error(`<#${voice.id}> is already bound to <#${partner}>. Please unbind before continuing.`, {ephemeral: true}));


        try {
            await text.permissionOverwrites.edit(interaction.guild.id, {SendMessages: false}, {reason: "Bind text and voice channel", type: OverwriteType.Role});
        }
        catch (err) {
            console.error(err);
            return await interaction.reply(Messages.error(`Unable to adjust permissions for <#${text.id}>. Make sure the bot has permission.`));
        }

        await voicetextDB.set(voice.id, text.id);
        await interaction.reply(Messages.success(`<#${voice.id}> is now bound to <#${text.id}>!`, {ephemeral: true}));
    },


    async unbind(interaction: ChatInputCommandInteraction<"cached">) {
        const targetChannel = interaction.options.getChannel("channel", true);
        const partner = await voicetextDB.get(targetChannel.id) ?? "";
        if (!partner) return await interaction.reply(Messages.error(`<#${targetChannel.id}> is not bound.`, {ephemeral: true}));

        /**
         * @type {import("discord.js").GuildChannel}
         */
        const text = interaction.guild.channels.cache.get(partner) as GuildChannel;
        if (text.type !== ChannelType.GuildText) return await interaction.reply(Messages.error("The text channel must be a text channel.", {ephemeral: true}));
        try {
            await text.permissionOverwrites.edit(interaction.guild.id, {SendMessages: null}, {reason: "Unbind text and voice channel", type: OverwriteType.Role});
        }
        catch (err) {
            console.error(err);
            return await interaction.reply(Messages.error(`Unable to adjust permissions for <#${text.id}>. Make sure the bot has permission.`));
        }

        await voicetextDB.delete(targetChannel.id);
        await interaction.reply(Messages.success(`<#${targetChannel.id}> is now unbound!`, {ephemeral: true}));
    },


    async status(interaction: ChatInputCommandInteraction) {
        const targetChannel = interaction.options.getChannel("channel", true);
        const partner = await voicetextDB.get(targetChannel.id) ?? "";
        await interaction.reply(Messages.info(partner ? `<#${targetChannel.id}> is bound to <#${partner}>` : `This channel <#${targetChannel.id}> is not bound.`, {ephemeral: true}));
    },
};

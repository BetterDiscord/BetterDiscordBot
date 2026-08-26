import {ApplicationCommandOptionType, ApplicationCommandType, ChannelType, ChatInputCommandInteraction, GuildChannel, InteractionContextType, OverwriteType, PermissionFlagsBits} from "discord.js";
import {defineCommand} from "../framework";
import {voicetextDB} from "../db";
import * as notices from "../util/notices";


const voiceOption = (description: string, name = "channel") => ({
    type: ApplicationCommandOptionType.Channel as const,
    name,
    description,
    required: true,
    channel_types: [ChannelType.GuildVoice as const]
});

async function bind(interaction: ChatInputCommandInteraction<"cached">) {
    const voice = interaction.options.getChannel("voice", true);
    const text = interaction.options.getChannel<ChannelType.GuildText>("text", true);
    if (voice.type !== ChannelType.GuildVoice) return await interaction.reply(notices.error("The voice channel must be a voice channel.", {ephemeral: true}));
    if (text.type !== ChannelType.GuildText) return await interaction.reply(notices.error("The text channel must be a text channel.", {ephemeral: true}));

    const partner = await voicetextDB.get(voice.id) ?? "";
    if (partner) return await interaction.reply(notices.error(`<#${voice.id}> is already bound to <#${partner}>. Please unbind before continuing.`, {ephemeral: true}));


    try {
        await text.permissionOverwrites.edit(interaction.guild.id, {SendMessages: false}, {reason: "Bind text and voice channel", type: OverwriteType.Role});
    }
    catch (err) {
        console.error(err);
        return await interaction.reply(notices.error(`Unable to adjust permissions for <#${text.id}>. Make sure the bot has permission.`));
    }

    await voicetextDB.set(voice.id, text.id);
    await interaction.reply(notices.success(`<#${voice.id}> is now bound to <#${text.id}>!`, {ephemeral: true}));
}


async function unbind(interaction: ChatInputCommandInteraction<"cached">) {
    const targetChannel = interaction.options.getChannel("channel", true);
    const partner = await voicetextDB.get(targetChannel.id) ?? "";
    if (!partner) return await interaction.reply(notices.error(`<#${targetChannel.id}> is not bound.`, {ephemeral: true}));

    /**
     * @type {import("discord.js").GuildChannel}
     */
    const text = interaction.guild.channels.cache.get(partner) as GuildChannel;
    if (text.type !== ChannelType.GuildText) return await interaction.reply(notices.error("The text channel must be a text channel.", {ephemeral: true}));
    try {
        await text.permissionOverwrites.edit(interaction.guild.id, {SendMessages: null}, {reason: "Unbind text and voice channel", type: OverwriteType.Role});
    }
    catch (err) {
        console.error(err);
        return await interaction.reply(notices.error(`Unable to adjust permissions for <#${text.id}>. Make sure the bot has permission.`));
    }

    await voicetextDB.delete(targetChannel.id);
    await interaction.reply(notices.success(`<#${targetChannel.id}> is now unbound!`, {ephemeral: true}));
}


async function status(interaction: ChatInputCommandInteraction) {
    const targetChannel = interaction.options.getChannel("channel", true);
    const partner = await voicetextDB.get(targetChannel.id) ?? "";
    await interaction.reply(notices.info(partner ? `<#${targetChannel.id}> is bound to <#${partner}>` : `This channel <#${targetChannel.id}> is not bound.`, {ephemeral: true}));
}


export const command = defineCommand({
    guildOnly: true,
    data: {
        type: ApplicationCommandType.ChatInput,
        name: "voicetext",
        description: "Binds one voice and one text channel together.",
        default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
        contexts: [InteractionContextType.Guild],
        options: [
            {type: ApplicationCommandOptionType.Subcommand, name: "status", description: "Checks the bound status of a voice channel.", options: [voiceOption("Which voice channel to check?")]},
            {type: ApplicationCommandOptionType.Subcommand, name: "unbind", description: "Unbinds a voice channel from it's partner.", options: [voiceOption("Which voice channel to unbind?")]},
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "bind",
                description: "Binds a voice and text channel together.",
                options: [
                    voiceOption("Which voice channel to bind?", "voice"),
                    {
                        type: ApplicationCommandOptionType.Channel as const,
                        name: "text",
                        description: "Which text channel to bind with?",
                        required: true,
                        channel_types: [ChannelType.GuildText as const]
                    }
                ]
            }
        ]
    },

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === "bind") return await bind(interaction);
        if (subcommand === "unbind") return await unbind(interaction);
        if (subcommand === "status") return await status(interaction);
    }
});

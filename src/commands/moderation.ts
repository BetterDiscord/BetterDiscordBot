import {ApplicationCommandOptionType, ApplicationCommandType, ChannelType, ChatInputCommandInteraction, InteractionContextType, PermissionFlagsBits} from "discord.js";
import {defineCommand} from "../framework";
import {guildDB} from "../db";
import * as notices from "../util/notices";


type ModuleKey = "invitefilter" | "detectspam";
type ChannelKey = "modlog" | "joinleave";


/** Shared by invitefilter and detectspam, which were byte-identical apart from the key. */
async function toggleModule(interaction: ChatInputCommandInteraction<"cached">, key: ModuleKey) {
    const toEnable = interaction.options.getBoolean("enable");
    const current = await guildDB.get(interaction.guild.id) ?? {};
    if (toEnable === null) return await interaction.reply(notices.info(`This module is currently ${current[key] ? "enabled" : "disabled"}.`, {ephemeral: true}));

    current[key] = toEnable;
    await guildDB.set(interaction.guild.id, current);

    await interaction.reply(notices.success(`This module has been ${toEnable ? "enabled" : "disabled"}.`, {ephemeral: true}));
}


/** Shared by modlog and joinleave, likewise. */
async function setChannel(interaction: ChatInputCommandInteraction<"cached">, key: ChannelKey, label: string) {
    const targetChannel = interaction.options.getChannel("channel");
    const current = await guildDB.get(interaction.guild.id) ?? {};

    if (targetChannel) current[key] = targetChannel.id;
    else delete current[key];
    await guildDB.set(interaction.guild.id, current);

    await interaction.reply(notices.success(targetChannel ? `${label} set to <#${targetChannel.id}>!` : `${label} has been unset!`, {ephemeral: true}));
}


const toggleOption = {
    type: ApplicationCommandOptionType.Boolean as const,
    name: "enable",
    description: "Enable or disable",
    required: false
};

const channelOption = (description: string) => ({
    type: ApplicationCommandOptionType.Channel as const,
    name: "channel",
    description,
    required: false,
    channel_types: [ChannelType.GuildText as const]
});


export const command = defineCommand({
    guildOnly: true,
    data: {
        type: ApplicationCommandType.ChatInput,
        name: "moderation",
        description: "Commands for moderating the server.",
        default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
        contexts: [InteractionContextType.Guild],
        options: [
            {type: ApplicationCommandOptionType.Subcommand, name: "invitefilter", description: "Toggles the invite filter module.", options: [toggleOption]},
            {type: ApplicationCommandOptionType.Subcommand, name: "detectspam", description: "Toggles the spam detection module.", options: [toggleOption]},
            {type: ApplicationCommandOptionType.Subcommand, name: "modlog", description: "Sets a channel to log bot moderation actions.", options: [channelOption("Where to log my actions?")]},
            {type: ApplicationCommandOptionType.Subcommand, name: "joinleave", description: "Sets a channel to log join/leave messages.", options: [channelOption("Where to log join/leave messages?")]}
        ]
    },

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === "invitefilter") return await toggleModule(interaction, "invitefilter");
        if (subcommand === "detectspam") return await toggleModule(interaction, "detectspam");
        if (subcommand === "modlog") return await setChannel(interaction, "modlog", "Modlog");
        if (subcommand === "joinleave") return await setChannel(interaction, "joinleave", "Join/leave");
    }
});

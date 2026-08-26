import {ApplicationCommandOptionType, ApplicationCommandType, ChatInputCommandInteraction, InteractionContextType, type GuildTextBasedChannel} from "discord.js";
import {defineCommand} from "../framework";
import {guildDB} from "../db";
import * as notices from "../util/notices";



const message = `Hi {{user}}, you have just been given the {{role}} role in the BetterDiscord server!`;
const dmMessage = `If you weren't already aware, we have a developer community server where developers can interact, help each other, and ask questions about creating plugins and themes. It's also the primary location for upcoming BetterDiscord news and announcements for developers. We'd love for you to join us if you haven't done so already: https://discord.gg/hC9wzzQeZv`;
const channelMessage = `By the way, normally this would have been sent to your DMs, but it seems your privacy settings prevented that. As a heads up, a lot of the information and communication from the website comes through DMs, so I would recommend adjusting that privacy option at least for the developer community server!`;

async function channel(interaction: ChatInputCommandInteraction<"cached">) {
    if (!interaction.member.permissions.has("Administrator")) return await interaction.reply(notices.error("You need to be an administrator to use this command!", {ephemeral: true}));
    const targetChannelId = interaction.options.getString("channel");

    // const targetGuild = await interaction.client.guilds.fetch(targetGuildId);
    const targetChannel = targetChannelId ? await interaction.client.channels.fetch(targetChannelId) : null;

    const current = await guildDB.get(interaction.guild.id) ?? {};
    if (targetChannel) {
        current.inviteChannel = targetChannel.id;
        await guildDB.set(interaction.guild.id, current);
    }
    else {
        delete current.inviteChannel;
        await guildDB.set(interaction.guild.id, current);
    }
    await interaction.reply(notices.success(targetChannel ? `Invite message channel set to <#${targetChannel.id}>!` : "Invite message channel has been unset!", {ephemeral: true}));
}


async function add(interaction: ChatInputCommandInteraction<"cached">) {
    if (!interaction.member.permissions.has("ManageRoles")) return await interaction.reply(notices.error("You need the `Manage Roles` permission to use this command!", {ephemeral: true}));
    await interaction.deferReply({ephemeral: true});
    const targetUser = interaction.options.getUser("user", true);
    const roleName = interaction.options.getString("role", true);

    const bdRoleId = roleName.toLowerCase().includes("plugin") ? "125166040689803264" : "165005972970930176";
    const bdGuild = await interaction.client.guilds.fetch("86004744966914048");
    try {
        const member = await bdGuild.members.fetch(targetUser);
        try {
            await member.roles.add(bdRoleId, "Developer verified");
        }
        catch {
            await interaction.editReply(notices.error("Could not add roles in main server!", {ephemeral: true}));
        }
    }
    catch {
        await interaction.editReply(notices.error("User is not in BetterDiscord server!", {ephemeral: true}));
    }

    let messageToSend = message.replace("{{user}}", `<@!${targetUser.id}>`).replace("{{role}}", roleName);
    try {
        const isMember = await interaction.guild.members.fetch(targetUser);
        if (!isMember) messageToSend += "\n\n" + dmMessage;
    }
    catch {
        messageToSend += "\n\n" + dmMessage;
    }


    try {
        await targetUser.send(messageToSend);
    }
    catch {
        await interaction.editReply(notices.error("Could not DM user!", {ephemeral: true}));

        const guildSettings = await guildDB.get(interaction.guild.id) ?? {};
        if (guildSettings.inviteChannel) {
            messageToSend += "\n\n" + channelMessage;
            /** @type {import("discord.js").GuildTextBasedChannel} */
            const inviteChannel = await interaction.client.channels.fetch(guildSettings.inviteChannel) as GuildTextBasedChannel;
            try {
                await inviteChannel?.send(messageToSend);
            }
            catch {
                await interaction.editReply(notices.error("Could not send a message in the invite channel!", {ephemeral: true}));
            }
        }
        else {
            await interaction.editReply(notices.error("Could not DM user and no fallback channel exists!", {ephemeral: true}));
        }
    }

    await interaction.editReply(notices.success("Role has been added successfully!", {ephemeral: true}));
}


async function sync(interaction: ChatInputCommandInteraction<"cached">) {
    const targetUser = interaction.options.getUser("user", true);
    const bdGuild = await interaction.client.guilds.fetch("86004744966914048");
    const bdMember = await bdGuild.members.fetch(targetUser);
    if (!bdMember) return await interaction.reply(notices.error("User is not in BetterDiscord server!", {ephemeral: true}));
    const isPluginDev = bdMember.roles.cache.has("125166040689803264");
    const isThemeDev = bdMember.roles.cache.has("165005972970930176");
    const rolesToAdd = [isPluginDev ? "948627723830591568" : "", isThemeDev ? "948627648706392104" : ""].filter(r => r);

    const communityMember = await interaction.guild.members.fetch(targetUser);

    try {
        await communityMember.roles.add(rolesToAdd, "Syncing roles from main server");
    }
    catch {
        return await interaction.reply(notices.error("Could not assign roles in this server!", {ephemeral: true}));
    }

    await interaction.reply(notices.success("Roles have been synced!", {ephemeral: true}));
}


const userOption = (description: string) => ({
    type: ApplicationCommandOptionType.User as const,
    name: "user",
    description,
    required: true
});

export const command = defineCommand({
    guildOnly: true,
    data: {
        type: ApplicationCommandType.ChatInput,
        name: "developer",
        description: "Manage roles for developers in the community.",
        contexts: [InteractionContextType.Guild],
        options: [
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "add",
                description: "Adds a new developer or new role to an existing developer.",
                options: [
                    userOption("Who is the developer in question?"),
                    {
                        type: ApplicationCommandOptionType.String,
                        name: "role",
                        description: "Role to add.",
                        required: true,
                        choices: [
                            {name: "Plugin Developer", value: "Plugin Developer"},
                            {name: "Theme Developer", value: "Theme Developer"}
                        ]
                    }
                ]
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "sync",
                description: "Syncs roles between severs.",
                options: [userOption("Which developer to resync?")]
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "channel",
                description: "Sets a channel to send invite messages.",
                options: [{
                    type: ApplicationCommandOptionType.String,
                    name: "channel",
                    description: "Which channel ID to send invites?",
                    required: false
                }]
            }
        ]
    },

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === "channel") return await channel(interaction);
        if (subcommand === "sync") return await sync(interaction);
        if (subcommand === "add") return await add(interaction);
    }
});

import {ChatInputCommandInteraction, SlashCommandBuilder, type GuildTextBasedChannel} from "discord.js";
import {guildDB} from "../db";
import Messages from "../util/messages";



const message = `Hi {{user}}, you have just been given the {{role}} role in the BetterDiscord server!`;
const dmMessage = `If you weren't already aware, we have a developer community server where developers can interact, help each other, and ask questions about creating plugins and themes. It's also the primary location for upcoming BetterDiscord news and announcements for developers. We'd love for you to join us if you haven't done so already: https://discord.gg/hC9wzzQeZv`;
const channelMessage = `By the way, normally this would have been sent to your DMs, but it seems your privacy settings prevented that. As a heads up, a lot of the information and communication from the website comes through DMs, so I would recommend adjusting that privacy option at least for the developer community server!`;

export default {
    data: new SlashCommandBuilder()
        .setName("developer")
        .setDescription("Manage roles for developers in the community.")
        .setDMPermission(false)
        .addSubcommand(
            c => c.setName("add").setDescription("Adds a new developer or new role to an existing developer.")
                .addUserOption(opt =>
                    opt.setName("user").setDescription("Who is the developer in question?").setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName("role").setDescription("Role to add.").setRequired(true)
                    .addChoices({name: "Plugin Developer", value: "Plugin Developer"}, {name: "Theme Developer", value: "Theme Developer"})
                )
        )
        .addSubcommand(
            c => c.setName("sync").setDescription("Syncs roles between severs.")
                .addUserOption(opt =>
                    opt.setName("user").setDescription("Which developer to resync?").setRequired(true)
                )
        )
        .addSubcommand(
            c => c.setName("channel").setDescription("Sets a channel to send invite messages.")
                // .addStringOption(opt =>
                //     opt.setName("guildId").setDescription("Which server to use as a base?").setRequired(false)
                // )
                .addStringOption(opt =>
                    opt.setName("channel").setDescription("Which channel ID to send invites?").setRequired(false)
                )
        ),


    async execute(interaction: ChatInputCommandInteraction<"cached">) {
        // TODO: change the deploy-commands script to allow setting guild commands for individual servers to render this check unnecessary
        if (interaction?.guild?.id !== "947985618502307840") return await Messages.error("This action can only be performed in the BD Developer Community server", {ephemeral: true});
        if (!interaction.member.roles.cache.has("948627723830591568") && !interaction.member.roles.cache.has("948647556450246717")) return await Messages.error("This action can only be performed by plugin and theme reviewers", {ephemeral: true});

        const command = interaction.options.getSubcommand();
        if (command === "channel") return await this.channel(interaction);
        if (command === "sync") return await this.sync(interaction);
        if (command === "add") return await this.add(interaction);
    },


    async channel(interaction: ChatInputCommandInteraction<"cached">) {
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
        await interaction.reply(Messages.success(targetChannel ? `Invite message channel set to <#${targetChannel.id}>!` : "Invite message channel has been unset!", {ephemeral: true}));
    },


    async add(interaction: ChatInputCommandInteraction<"cached">) {
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
                await interaction.editReply(Messages.error("Could not add roles in main server!", {ephemeral: true}));
            }
        }
        catch {
            await interaction.editReply(Messages.error("User is not in BetterDiscord server!", {ephemeral: true}));
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
            await interaction.editReply(Messages.error("Could not DM user!", {ephemeral: true}));

            const guildSettings = await guildDB.get(interaction.guild.id) ?? {};
            if (guildSettings.inviteChannel) {
                messageToSend += "\n\n" + channelMessage;
                /** @type {import("discord.js").GuildTextBasedChannel} */
                const inviteChannel = await interaction.client.channels.fetch(guildSettings.inviteChannel) as GuildTextBasedChannel;
                try {
                    await inviteChannel?.send(messageToSend);
                }
                catch {
                    await interaction.editReply(Messages.error("Could not send a message in the invite channel!", {ephemeral: true}));
                }
            }
            else {
                await interaction.editReply(Messages.error("Could not DM user and no fallback channel exists!", {ephemeral: true}));
            }
        }

        await interaction.editReply(Messages.success("Role has been added successfully!", {ephemeral: true}));
    },


    async sync(interaction: ChatInputCommandInteraction<"cached">) {
        const targetUser = interaction.options.getUser("user", true);
        const bdGuild = await interaction.client.guilds.fetch("86004744966914048");
        const bdMember = await bdGuild.members.fetch(targetUser);
        if (!bdMember) return await interaction.reply(Messages.error("User is not in BetterDiscord server!", {ephemeral: true}));
        const isPluginDev = bdMember.roles.cache.has("125166040689803264");
        const isThemeDev = bdMember.roles.cache.has("165005972970930176");
        const rolesToAdd = [isPluginDev ? "948627723830591568" : "", isThemeDev ? "948627648706392104" : ""].filter(r => r);

        const communityMember = await interaction.guild.members.fetch(targetUser);

        try {
            await communityMember.roles.add(rolesToAdd, "Syncing roles from main server");
        }
        catch {
            return await interaction.reply(Messages.error("Could not assign roles in this server!", {ephemeral: true}));
        }

        await interaction.reply(Messages.success("Roles have been synced!", {ephemeral: true}));
    },

};

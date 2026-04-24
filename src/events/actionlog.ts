import {EmbedBuilder, Events, type Guild, type GuildBan, type GuildMember, type Message, type PartialGuildMember, type PartialMessage} from "discord.js";
import {guildDB} from "../db";
import Colors from "../util/colors";
import type {ActionLogEvent} from "../types";


async function getLogChannel(guild: Guild, event: ActionLogEvent) {
    const settings = await guildDB.get(guild.id);
    if (!settings?.actionlog) return null;
    // An event is enabled unless explicitly set to false
    if (settings.actionlogEvents?.[event] === false) return null;
    const channel = guild.channels.cache.get(settings.actionlog);
    if (!channel?.isTextBased()) return null;
    return channel;
}


export default [
    {
        name: Events.MessageDelete,

        async execute(message: Message | PartialMessage) {
            if (!message.inGuild() || message.author?.bot) return;

            const logChannel = await getLogChannel(message.guild, "message_delete");
            if (!logChannel) return;

            const embed = new EmbedBuilder()
                .setColor(Colors.Danger)
                .setTitle("Message Deleted")
                .addFields(
                    {name: "Author", value: message.author ? `<@${message.author.id}> (${message.author.tag})` : "Unknown", inline: true},
                    {name: "Channel", value: `<#${message.channelId}>`, inline: true}
                )
                .setFooter({text: `Message ID: ${message.id}`})
                .setTimestamp();

            if (message.content) embed.setDescription(message.content.substring(0, 4096));

            await logChannel.send({embeds: [embed]}).catch(console.error);
        },
    },
    {
        name: Events.MessageUpdate,

        async execute(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) {
            if (!newMessage.inGuild() || !newMessage.author || newMessage.author.bot) return;
            if (oldMessage.content === newMessage.content) return;

            const logChannel = await getLogChannel(newMessage.guild, "message_edit");
            if (!logChannel) return;

            const embed = new EmbedBuilder()
                .setColor(Colors.Info)
                .setTitle("Message Edited")
                .setURL(newMessage.url)
                .addFields(
                    {name: "Author", value: `<@${newMessage.author.id}> (${newMessage.author.tag})`, inline: true},
                    {name: "Channel", value: `<#${newMessage.channelId}>`, inline: true},
                    {name: "Before", value: oldMessage.content?.substring(0, 500) || "*Not available*"},
                    {name: "After", value: newMessage.content?.substring(0, 500) || "*Empty*"}
                )
                .setFooter({text: `Message ID: ${newMessage.id}`})
                .setTimestamp();

            await logChannel.send({embeds: [embed]}).catch(console.error);
        },
    },
    {
        name: Events.GuildBanAdd,

        async execute(ban: GuildBan) {
            const logChannel = await getLogChannel(ban.guild, "member_ban");
            if (!logChannel) return;

            const embed = new EmbedBuilder()
                .setColor(Colors.Danger)
                .setTitle("Member Banned")
                .setThumbnail(ban.user.displayAvatarURL())
                .addFields(
                    {name: "User", value: `<@${ban.user.id}> (${ban.user.tag})`, inline: true},
                    {name: "Reason", value: ban.reason ?? "No reason provided"}
                )
                .setFooter({text: `User ID: ${ban.user.id}`})
                .setTimestamp();

            await logChannel.send({embeds: [embed]}).catch(console.error);
        },
    },
    {
        name: Events.GuildBanRemove,

        async execute(ban: GuildBan) {
            const logChannel = await getLogChannel(ban.guild, "member_unban");
            if (!logChannel) return;

            const embed = new EmbedBuilder()
                .setColor(Colors.Success)
                .setTitle("Member Unbanned")
                .setThumbnail(ban.user.displayAvatarURL())
                .addFields(
                    {name: "User", value: `<@${ban.user.id}> (${ban.user.tag})`, inline: true}
                )
                .setFooter({text: `User ID: ${ban.user.id}`})
                .setTimestamp();

            await logChannel.send({embeds: [embed]}).catch(console.error);
        },
    },
    {
        name: Events.GuildMemberUpdate,

        async execute(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
            // Nickname changes
            if (oldMember.nickname !== newMember.nickname) {
                const logChannel = await getLogChannel(newMember.guild, "nickname_change");
                if (logChannel) {
                    const embed = new EmbedBuilder()
                        .setColor(Colors.Info)
                        .setTitle("Nickname Changed")
                        .addFields(
                            {name: "User", value: `<@${newMember.user.id}> (${newMember.user.tag})`, inline: true},
                            {name: "Before", value: oldMember.nickname ?? "*None*", inline: true},
                            {name: "After", value: newMember.nickname ?? "*None*", inline: true}
                        )
                        .setFooter({text: `User ID: ${newMember.user.id}`})
                        .setTimestamp();

                    await logChannel.send({embeds: [embed]}).catch(console.error);
                }
            }

            // Role changes — only reliable when the old member was fully cached
            if (!oldMember.partial) {
                const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
                const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

                if (addedRoles.size || removedRoles.size) {
                    const logChannel = await getLogChannel(newMember.guild, "role_change");
                    if (logChannel) {
                        const embed = new EmbedBuilder()
                            .setColor(Colors.Info)
                            .setTitle("Member Roles Updated")
                            .addFields(
                                {name: "User", value: `<@${newMember.user.id}> (${newMember.user.tag})`, inline: true}
                            )
                            .setFooter({text: `User ID: ${newMember.user.id}`})
                            .setTimestamp();

                        if (addedRoles.size) embed.addFields({name: "Roles Added", value: addedRoles.map(r => `<@&${r.id}>`).join(", ")});
                        if (removedRoles.size) embed.addFields({name: "Roles Removed", value: removedRoles.map(r => `<@&${r.id}>`).join(", ")});

                        await logChannel.send({embeds: [embed]}).catch(console.error);
                    }
                }
            }
        },
    },
];

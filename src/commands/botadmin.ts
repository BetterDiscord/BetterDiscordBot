import {
    ApplicationCommandOptionType, ApplicationCommandType, ChannelType, ChatInputCommandInteraction,
    ComponentType, TextInputStyle,
    type ModalComponentData, type PartialTextBasedChannelFields
} from "discord.js";
import {awaitModal, defineCommand} from "../framework";
import {globalDB} from "../db";
import * as notices from "../util/notices";


const sendModal: ModalComponentData = {
    customId: "botadmin-send",
    title: "Message To Send",
    components: [{
        type: ComponentType.Label,
        label: "Message",
        component: {
            type: ComponentType.TextInput,
            customId: "message",
            label: "Message",
            style: TextInputStyle.Paragraph,
            required: true,
            maxLength: 2000,
            value: ""
        }
    }]
};


async function send(interaction: ChatInputCommandInteraction, target: PartialTextBasedChannelFields) {
    const submission = await awaitModal(interaction, sendModal, ["message"], {time: 60_000});
    if (!submission) return await interaction.followUp(notices.error("Modal submission timed out!", {ephemeral: true}));

    try {
        await target.send(submission.values.message);
        await submission.submission.reply(notices.success("Message sent successfully!", {ephemeral: true}));
    }
    catch {
        await submission.submission.reply(notices.error("Could not send message!", {ephemeral: true}));
    }
}


async function forwarding(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getUser("user");
    if (targetUser) await globalDB.set("forwarding", targetUser.id);
    else await globalDB.delete("forwarding");
    await interaction.reply(notices.success(targetUser ? `Now forwarding DMs to <@${targetUser.id}>!` : "No longer forwarding DMs!", {ephemeral: true}));
}


async function quit(interaction: ChatInputCommandInteraction) {
    await interaction.reply(notices.info("Bot shutting down...", {ephemeral: true}));
    await interaction.client.destroy();
    process.exit(0);
}


export const command = defineCommand({
    ownerOnly: true,
    data: {
        type: ApplicationCommandType.ChatInput,
        name: "botadmin",
        description: "Global settings for the bot during runtime.",
        options: [
            {
                type: ApplicationCommandOptionType.SubcommandGroup,
                name: "send",
                description: "Sends messages to different locations",
                options: [
                    {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: "user",
                        description: "Sends a DM to the specified user.",
                        options: [{
                            type: ApplicationCommandOptionType.User,
                            name: "user",
                            description: "User to DM.",
                            required: true
                        }]
                    },
                    {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: "channel",
                        description: "Sends a message to the specified channel.",
                        options: [{
                            type: ApplicationCommandOptionType.Channel,
                            name: "channel",
                            description: "Channel to send a message.",
                            required: true,
                            channel_types: [ChannelType.GuildText]
                        }]
                    }
                ]
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "forwarding",
                description: "Sets up DM forwarding to a user.",
                options: [{
                    type: ApplicationCommandOptionType.User,
                    name: "user",
                    description: "Who to forward DMs to?",
                    required: false
                }]
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "quit",
                description: "Exits the bot gracefully."
            }
        ]
    },

    // The owner check is the dispatcher's job now; `ownerOnly` above also keeps
    // this command deployed to the private guild rather than globally.
    async execute(interaction) {
        const group = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();

        if (group === "send") {
            if (subcommand === "channel") return await send(interaction, interaction.options.getChannel<ChannelType.GuildText>("channel", true));
            if (subcommand === "user") return await send(interaction, interaction.options.getUser("user", true));
        }
        if (subcommand === "forwarding") return await forwarding(interaction);
        if (subcommand === "quit") return await quit(interaction);
    }
});

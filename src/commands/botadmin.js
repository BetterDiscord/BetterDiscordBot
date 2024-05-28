const {SlashCommandBuilder, EmbedBuilder, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle} = require("discord.js");
const path = require("path");
const Keyv = require("keyv");
const Colors = require("../util/colors");
const settings = new Keyv("sqlite://" + path.resolve(__dirname, "..", "..", "settings.sqlite3"), {namespace: "global"});


module.exports = {
    owner: true,
    data: new SlashCommandBuilder()
        .setName("botadmin")
        .setDescription("Global settings for the bot during runtime.")
        .addSubcommandGroup(group => 
            group.setName("send").setDescription("Sends messages to different locations")
                .addSubcommand(c =>
                    c.setName("user").setDescription("Sends a DM to the specified user.")
                        .addUserOption(opt => 
                            opt.setName("user").setDescription("User to DM.").setRequired(true)
                        )
                )
                .addSubcommand(c =>
                    c.setName("channel").setDescription("Sends a message to the specified channel.")
                        .addChannelOption(opt => 
                            opt.setName("channel").setDescription("Channel to send a message.").setRequired(true)
                        )
                )
        )
        .addSubcommand(
            c => c.setName("forwarding").setDescription("Sets up DM forwarding to a user.")
                .addUserOption(opt =>
                    opt.setName("user").setDescription("Who to forward DMs to?").setRequired(false)
                )
        )
        .addSubcommand(c => c.setName("quit").setDescription("Exits the bot gracefully.")),

    /** 
     * @param interaction {import("discord.js").ChatInputCommandInteraction}
     */
    async execute(interaction) {
        if (interaction.user.id !== process.env.BOT_OWNER_ID) return await interaction.reply({content: "Sorry this command is only usable by the owner!", ephemeral: true});

        const group = interaction.options.getSubcommandGroup();
        const command = interaction.options.getSubcommand();
        if (group === "send") {
            if (command === "channel") return await this.channel(interaction);
            if (command === "user") return await this.user(interaction);
        }
        if (command === "forwarding") return await this.forwarding(interaction);
        if (command === "quit") return await this.quit(interaction);
    },


    /** 
     * @param interaction {import("discord.js").ChatInputCommandInteraction}
     */
    async channel(interaction) {
        return await this.send(interaction, interaction.options.getChannel("channel", true));
    },


    /** 
     * @param interaction {import("discord.js").ChatInputCommandInteraction}
     */
    async user(interaction) {
        return await this.send(interaction, interaction.options.getUser("user", true));
    },


    /** 
     * @param interaction {import("discord.js").ChatInputCommandInteraction}
     * @param target {import("discord.js").PartialTextBasedChannelFields}
     */
    async send(interaction, target) {
        const modal = new ModalBuilder().setTitle("Message To Send").setCustomId("botadmin-send")
            .addComponents(
                new ActionRowBuilder()
                    .addComponents(
                        new TextInputBuilder()
                            .setCustomId("message")
                            .setLabel("Message")
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(true)
                            .setMaxLength(2000)
                            .setValue("")
                    )
                );

        
        await interaction.showModal(modal);

        try {
            const modalInteraction = await interaction.awaitModalSubmit({time: 60_000});
            const message = modalInteraction.fields.getTextInputValue("message");
            try {
                await target.send(message);
                await modalInteraction.reply({embeds: [new EmbedBuilder().setColor(Colors.Success).setDescription("Message sent successfully!")], ephemeral: true});
            }
            catch {
                await modalInteraction.reply({embeds: [new EmbedBuilder().setColor(Colors.Error).setDescription("Could not send message!")], ephemeral: true});
            }
        }
        catch {
            await interaction.followUp({embeds: [new EmbedBuilder().setColor(Colors.Error).setDescription("Modal submission timed out!")], ephemeral: true});
        }
    },

    /**
     * This is just here to satisfy the event requirement I imposed on myself
     */
    async modal() {},


    /** 
     * @param interaction {import("discord.js").ChatInputCommandInteraction}
     */
    async forwarding(interaction) {
        const targetUser = interaction.options.getUser("user");
        if (targetUser) await settings.set("forwarding", targetUser.id);
        else await settings.delete("forwarding");
        await interaction.reply({embeds: [new EmbedBuilder().setColor(Colors.Success).setDescription(targetUser ? `Now forwarding DMs to <@${targetUser.id}>!` : "No longer forwarding DMs!")], ephemeral: true});
    },


    /** 
     * @param interaction {import("discord.js").ChatInputCommandInteraction}
     */
    async quit(interaction) {
        await interaction.reply({embeds: [new EmbedBuilder().setColor(Colors.Info).setDescription("Bot shutting down...")], ephemeral: true});
        await interaction.client.destroy();
        process.exit(0);
    },
};

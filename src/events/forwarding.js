const {Events, EmbedBuilder} = require("discord.js");
const path = require("path");
const Keyv = require("keyv");
const settings = new Keyv("sqlite://" + path.resolve(__dirname, "..", "..", "settings.sqlite3"), {namespace: "global"});


module.exports = {
    name: Events.MessageCreate,

    /** 
     * @param {import("discord.js").Message} message
     */
    async execute(message) {
        // Ignore guild messages and owner DMs
        if (message.inGuild() || message.author.bot) return;
        if (message.author.id === message.client.user.id) return;
        if (message.author.id === process.env.BOT_OWNER_ID) return;
        const target = await settings.get("forwarding") ?? "";
        if (!target) return;
        const user = message.client.users.cache.get(target);
        if (!user) return;

        const embed = new EmbedBuilder()
            .setAuthor({name: `${message.author.displayName} (${message.author.id})`, iconURL: message.author.displayAvatarURL()})
            .setDescription(message.content ?? "\u200B");
        
        if (message.attachments.size) {
            for (const [id, att] of message.attachments) {
                embed.addFields({name: att.name, value: `[${id}](${att.url})`});
            }
        }

        await user.send({embeds: [embed]});
    },
};
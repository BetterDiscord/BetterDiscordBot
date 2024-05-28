const {Events, EmbedBuilder} = require("discord.js");
const path = require("path");
const Keyv = require("keyv");
const settings = new Keyv("sqlite://" + path.resolve(__dirname, "..", "..", "settings.sqlite3"), {namespace: "global"});


module.exports = {
    name: Events.MessageCreate,

    /** 
     * @param msg {import("discord.js").Message}
     */
    async execute(msg) {
        // Ignore guild messages and owner DMs
        if (msg.inGuild()) return;
        if (msg.author.id === process.env.BOT_OWNER_ID) return;
        const target = await settings.get("forwarding") ?? "";
        if (!target) return;
        const user = msg.client.users.cache.get(target);
        if (!user) return;

        const embed = new EmbedBuilder()
            .setAuthor({name: `${msg.author.displayName} (${msg.author.id})`, iconURL: msg.author.displayAvatarURL()})
            .setDescription(msg.content);
        
        if (msg.attachments.size) {
            for (const [id, att] of msg.attachments) {
                embed.addFields({name: `${att.name} (${id})`, value: `[${att.url}](${att.url})`});
            }
        }

        await user.send({embeds: [embed]});
    },
};
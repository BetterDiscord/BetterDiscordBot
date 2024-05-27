const {Command} = require("discord.js-commando");

module.exports = class extends Command {
    constructor(client) {
        super(client, {
            name: "modlog",
            group: "moderation",
            memberName: "modlog",
            description: "Check and set the modlog channel",
            format: `[<channel>|"status"]`,
            guildOnly: true,
            userPermissions: ["KICK_MEMBERS"],
            args: [
                {
                    key: "channel",
                    prompt: "Where should this info be logged?",
                    type: "channel|string",
                    defaultValue: "status"
                }
            ],
            examples: ["modlog", "modlog status", "modlog #mod-log"]
        });
    }
    
    async run(msg, {channel}) {
        const modlogId = await msg.guild.settings.get("modlog", "");
        const savedChannel = msg.guild.channels.cache.get(modlogId);
        if (typeof(channel) === "string") {
            if (channel === "status") return await msg.info(`${savedChannel ? `Modlogs are set to appear in ${savedChannel}.` : "No modlog is set."}`);
            return await msg.failure(`Did not understand your input. Try ${msg.anyUsage("help modlog", undefined, null)} for help.`);
        }

        if (channel.id == modlogId) return await msg.failure(`${channel} is already set.`); // Check if setting same channel
        if (channel.type !== "text") return await msg.failure(`Can only log in text channels.`); // Check for text channel
        if (!channel.permissionsFor(this.client.user).has(["VIEW_CHANNEL", "SEND_MESSAGES"])) return await msg.failure(`${this.client.user.username} does not have permissions to read/send messages in ${channel}.`); // Permissions check
        await msg.guild.settings.set("modlog", channel.id);
        await msg.success(`The modlog is now set to ${channel}.`);        
    }
};
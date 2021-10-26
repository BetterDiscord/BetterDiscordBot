const {Command} = require("discord.js-commando");

module.exports = class extends Command {
    constructor(client) {
        super(client, {
            name: "join",
            group: "meta",
            memberName: "join",
            ownerOnly: true,
            description: "Generate an invite link to invite this bot."
        });
    }
    
    async run(msg) {
        const link = await this.client.generateInvite(["SEND_MESSAGES", "MANAGE_ROLES", "KICK_MEMBERS"]);
        await msg.author.send({embed: {title: "Thanks for inviting me!", description: `Click this link to add me to your server: ${link}`}});
    }
};

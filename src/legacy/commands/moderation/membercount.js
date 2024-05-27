const {Command} = require("discord.js-commando");

module.exports = class extends Command {
    constructor(client) {
        super(client, {
            name: "membercount",
            aliases: ["mc"],
            group: "moderation",
            memberName: "membercount",
            description: "Gets the number of members in a role.",
            guildOnly: true,
            userPermissions: ["MANAGE_ROLES"],
            args: [
                {
                    key: "roleName",
                    prompt: "What role do you want to check?",
                    type: "string"
                }
            ]
        });
    }
    
    async run(msg, {roleName}) {
        const reqRole = roleName.trim().toLowerCase();
        const role = msg.guild.roles.cache.find(r => reqRole === r.name.toLowerCase());
        if (!role) return await msg.failure(`Could not find role named "${roleName}".`);
        await msg.info(`There are ${role.members.size} members with the role ${roleName}.`);
    }
};
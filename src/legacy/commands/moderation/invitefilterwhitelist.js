const {Command} = require("discord.js-commando");

module.exports = class extends Command {
    constructor(client) {
        super(client, {
            name: "invitefilterwhitelist",
            aliases: ["ifw"],
            group: "moderation",
            memberName: "invitefilterwhitelist",
            description: "Adds a whitelisted invite that will always be deleted.",
            guildOnly: true,
            ownerOnly: true,
            userPermissions: ["MANAGE_MESSAGES"],
            args: [
                {
                    key: "action",
                    prompt: "What action should be taken?",
                    type: "string",
                    oneOf: ["add", "remove", "view"],
                    defaultValue: "view"
                },
                {
                    key: "invite",
                    prompt: "What invite code should be whitelisted?",
                    type: "string",
                    defaultValue: ""
                }
            ]
        });
    }

    async run(msg, {action, invite}) {
        const state = await msg.guild.settings.get("invitefilter", {enabled: false, whitelist: [], blacklist: []});

        if (action === "view") {
            const codeString = state.whitelist.map(b => "`" + b + "`").join(", ");
            return await msg.info(`**Whitelisted Codes:**\n${codeString}`);
        }
        if (!invite || invite.toLowerCase().includes("discord")) return await msg.failure("Please provide __only__ the invite code");
        if (action === "add") {
            if (state.whitelist.includes(invite)) return await msg.failure("This invite code is already whitelisted.");
            if (state.blacklist.includes(invite)) return await msg.failure("Cannot whitelist an invite code that is whitelisted.");
            state.whitelist.push(invite);
        }
        else if (action === "remove") {
            if (!state.whitelist.includes(invite)) return await msg.failure("This invite code is not whitelisted.");
            state.whitelist.splice(state.whitelist.indexOf(invite), 1);
        }

        await msg.success(`The invite code was successfully ${action}ed.`);
        await msg.guild.settings.set("invitefilter", state);
    }
};


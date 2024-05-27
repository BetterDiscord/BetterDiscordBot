const {MessageEmbed} = require("discord.js");
const {Command} = require("discord.js-commando");

// const discordInviteRegex = new RegExp(`(?:https?:\\/\\/)?discord(?:app)?\\.(?:gg|com)\\/(?:invite\\/)?([A-Z0-9]+)`, "i");
const discordInviteRegex = new RegExp(`(?:https?:\\/\\/)?discord\\.gg\\/?([A-Z0-9]+)`, "ig");
const oldInviteRegex = new RegExp(`(?:https?:\\/\\/)?discordapp\\.com\\/invite\\/?([A-Z0-9]+)`, "ig");

module.exports = class extends Command {
    constructor(client) {
        super(client, {
            name: "invitefilter",
            aliases: ["if"],
            group: "moderation",
            memberName: "invitefilter",
            description: "Filters out messages with invites.",
            guildOnly: true,
            ownerOnly: true,
            userPermissions: ["MANAGE_ROLES"],
            args: [
                {
                    key: "action",
                    prompt: "What action should be taken by default?",
                    type: "string",
                    oneOf: ["on", "off", "status"],
                    defaultValue: "status"
                }
            ]
        });
    }

    async onMessage(message) {
        // Ignore commands or responses to prompts
        if (!this.client.dispatcher.shouldHandleMessage(message)) return;

        // Ignore messages from owner or DMs
        if (!message.guild || this.client.isOwner(message.author)) return;

        // MANAGE_MESSAGES can bypass this detection
        if (message.channel.permissionsFor(message.author).has(["MANAGE_MESSAGES"])) return;

        const inviteMatches = [...message.content.matchAll(discordInviteRegex)];
        const oldInviteMatches = [...message.content.matchAll(oldInviteRegex)];
        if (!inviteMatches.length && !oldInviteMatches.length) return; // No invites found, bail

        const moduleState = message.guild.settings.get("invitefilter", {enabled: false, whitelist: [], blacklist: []});
        let allWhitelisted = inviteMatches.every(i => moduleState.whitelist.includes(i[1]));
        let hasBlacklisted = inviteMatches.some(i => moduleState.blacklist.includes(i[1]));

        // console.log(inviteMatches, allWhitelisted, hasBlacklisted);

        allWhitelisted = allWhitelisted && oldInviteMatches.every(i => moduleState.whitelist.includes(i[1]));
        hasBlacklisted = hasBlacklisted && oldInviteMatches.some(i => moduleState.blacklist.includes(i[1]));

        // console.log(oldInviteMatches, allWhitelisted, hasBlacklisted);

        // When to clean:
        // If default clean is on, and we found not whitelisted
        // If default clean is off, and we found blacklisted
        //
        // When to avoid:
        // If default clean is on and all whitelisted
        // if default clean is off and no blacklisted
        if (moduleState.enabled && allWhitelisted) return;
        if (!moduleState.enabled && !hasBlacklisted) return;

        await message.delete({reason: "Discord Invite"});

        let didMute = false;
        const muteRoleId = message.guild.roles.cache.findKey(r => r.name.toLowerCase().includes("mute"));
        if (muteRoleId) {
            const member = message.guild.members.cache.get(message.author.id);
            if (member && !member.roles.cache.has(muteRoleId)) {
                await member.roles.add(muteRoleId);
                didMute = true;
            }
        }

        const modlogId = message.guild.settings.get("modlog", "");
        const modlogChannel = message.guild.channels.cache.get(modlogId);
        if (!modlogId || !modlogChannel) return; // Can't log

        const deletionEmbed = new MessageEmbed();
        deletionEmbed.setAuthor(message.author.tag, message.author.displayAvatarURL());
        deletionEmbed.setDescription(`Message sent by ${message.author} in ${message.channel}\n\n` + message.content);
        deletionEmbed.addField("Reason", "Discord Invite", false);
        deletionEmbed.setFooter(`ID: ${message.author.id}`);
        deletionEmbed.setTimestamp(message.createdTimestamp);
        deletionEmbed.setColor("#3E82E5");
        modlogChannel.send(deletionEmbed);


        if (didMute) {
            const mutedEmbed = new MessageEmbed();
            mutedEmbed.setAuthor("Member Muted", message.author.displayAvatarURL());
            mutedEmbed.setDescription(`${message.author} ${message.author.tag}`);
            mutedEmbed.addField("Reason", "Discord Invite", false);
            mutedEmbed.setFooter(`ID: ${message.author.id}`);
            mutedEmbed.setTimestamp(message.createdTimestamp);
            deletionEmbed.setColor("#3E82E5");
            modlogChannel.send(mutedEmbed);
        }
    }

    async run(msg, {action}) {
        const state = await msg.guild.settings.get("invitefilter", {enabled: false, whitelist: [], blacklist: []});

        if (action === "status") return await msg.info(`Invites will${state.enabled ? "" : " __not__"} be automatically deleted.`);

        if (action === "on" && state.enabled || action === "off" && !state.enabled) return await msg.failure(`This module is already ${action}.`); // Check if setting same
        state.enabled = action === "on";
        await msg.success(`The delete invite module is set to ${action}.`);
        await msg.guild.settings.set("invitefilter", state);
    }
};


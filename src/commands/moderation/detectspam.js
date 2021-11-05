const {MessageEmbed} = require("discord.js");
const {Command} = require("discord.js-commando");

const fakeDiscordRegex = new RegExp(`([a-zA-Z-\\.]+)?d[il][il]?scorr?(cl|[ldb])([a-zA-Z-\\.]+)?\\.(com|net|app|gift|ru|uk)`, "ig");
const okayDiscordRegex = new RegExp(`([a-zA-Z-\\.]+\\.)?discord(app)?\\.(com|net|app)`, "i");
const fakeSteamRegex = new RegExp(`str?e[ea]?mcomm?m?un[un]?[un]?[tl]?[il][tl]?ty\\.(com|net|ru|us)`, "ig");
const sketchyRuRegex = new RegExp(`([a-zA-Z-\\.]+).ru.com`, "ig");

module.exports = class extends Command {
    constructor(client) {
        super(client, {
            name: "detectspam",
            group: "moderation",
            memberName: "detectspam",
            description: "Toggles the spam detection module",
            guildOnly: true,
            ownerOnly: true,
            userPermissions: ["MANAGE_ROLES"]
        });
    }

    async onMessage(message) {

        // Check if module active
        const moduleState = message.guild.settings.get("detectspam", {enabled: false});
        if (!moduleState.enabled) return;

        // Ignore messages from owner or DMs
        if (!message.guild || this.client.isOwner(message.author)) return;

        // MANAGE_MESSAGES can bypass this detection
        if (message.channel.permissionsFor(message.author).has(["MANAGE_MESSAGES"])) return;

        // console.log(message.content.match(fakeDiscordRegex));
        // console.log(message.content.match(fakeSteamRegex));

        const fakeDiscordMatches = message.content.match(fakeDiscordRegex) || [];
        const fakeSteamMatches = message.content.match(fakeSteamRegex) || [];
        const isFakeDiscord = fakeDiscordMatches.some(s => {
            if (okayDiscordRegex.test(s)) return false;
            else if (s.toLowerCase()  === "betterdiscord.app") return false;
            return true;
        });
        const isFakeSteam = fakeSteamMatches.some(s => s.toLowerCase() !== "steamcommunity.com");
        const isSketchy = sketchyRuRegex.test(message.content);
        if (!isFakeDiscord && !isFakeSteam && !isSketchy) return; // Not spam, let's get out of here

        let reason = "Sketchy Link";
        if (isFakeDiscord) reason = "Fake Discord Link";
        if (isFakeSteam) reason = "Fake Steam Link";

        await message.delete({reason: "Spam detected"});

        let didMute = false;
        const muteRoleId = message.guild.roles.cache.findKey(r => r.name.toLowerCase().includes("mute"));
        if (muteRoleId) {
            const member = message.guild.members.cache.get(message.author.id);
            if (member) {
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
        deletionEmbed.addField("Reason", reason, false);
        deletionEmbed.setFooter(`ID: ${message.author.id}`);
        deletionEmbed.setTimestamp(message.createdTimestamp);
        deletionEmbed.setColor("#3E82E5");
        modlogChannel.send(deletionEmbed);


        if (didMute) {
            const mutedEmbed = new MessageEmbed();
            mutedEmbed.setAuthor("Member Muted", message.author.displayAvatarURL());
            mutedEmbed.setDescription(`${message.author} ${message.author.tag}`);
            mutedEmbed.addField("Reason", reason, false);
            mutedEmbed.setFooter(`ID: ${message.author.id}`);
            mutedEmbed.setTimestamp(message.createdTimestamp);
            deletionEmbed.setColor("#3E82E5");
            modlogChannel.send(mutedEmbed);
        }
    }

    async run(msg) {
        const state = await msg.guild.settings.get("detectspam", {enabled: false});
        state.enabled = !state.enabled;
        await msg.guild.settings.set("detectspam", state);
        await msg.info(`Turned spam detection ${state.enabled ? "ON" : "OFF"}.`);
    }
};

//732946168241455134


const {Command} = require("discord.js-commando");

module.exports = class extends Command {
    constructor(client) {
        super(client, {
            name: "fixnicks",
            group: "moderation",
            memberName: "fixnicks",
            description: "Fixes all nicknames on the server.",
            guildOnly: true,
            userPermissions: ["MANAGE_NICKNAMES"]
        });
    }

    async onGuildMemberAdd(member) {
        const current = member.nickname || member.user.username;
        let normalized = current.replace(/[^A-Za-z0-9 ]/g, "");
        if (!normalized.length) normalized = "stupid name";
        if (current === normalized) return; // Current name is fine
        try {await member.setNickname(normalized);}
        catch (err) {}
    }
    
    async run(msg) {
        const members = msg.guild.members.cache;
        await msg.info(`Going to fix the nickname of ${members.size} members. This will take approximately ${humanReadableUptime(members.size * 1000)}. Please be patient.`);
        const start = Date.now();
        for (const [, member] of members) {
            const current = member.nickname || member.user.username;
            let normalized = current.replace(/[^A-Za-z0-9 ]/g, "");
            if (!normalized.length) normalized = "stupid name";
            if (current === normalized) continue; // Current name is fine
            try {await member.setNickname(normalized);}
            catch (err) {await msg.failure(`Could not set nickname for \`${current}\`.`);}
        }
        const finish = Date.now();
        await msg.success(`Finished fixing ${members.size} nicknames. It took ${humanReadableUptime(finish - start)}.`);      
    }
};

const msInSecond = 1000;
const msInMinute = msInSecond * 60;
const msInHour = msInMinute * 60;
const msInDay = msInHour * 24;

function humanReadableUptime(uptime) {
    let remainder = uptime;
    const days = Math.floor(uptime / msInDay);
    remainder = remainder - (days * msInDay);
    const hours = Math.floor(remainder / msInHour);
    remainder = remainder - (hours * msInHour);
    const minutes = Math.floor(remainder / msInMinute);
    remainder = remainder - (minutes * msInMinute);
    const seconds = Math.floor(remainder / msInSecond);
    
    let humanReadable = `${seconds}s`;
    if (minutes) humanReadable = `${minutes}m ${humanReadable}`;
    if (hours) humanReadable = `${hours}h ${humanReadable}`;
    if (days) humanReadable = `${days}d ${humanReadable}`;
    return humanReadable;
}

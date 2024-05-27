const {Command} = require("discord.js-commando");

module.exports = class extends Command {
    constructor(client) {
        super(client, {
            name: "kickmutual",
            group: "moderation",
            memberName: "kickmutual",
            description: "Kicks all members that are in another mutual server",
            guildOnly: true,
            ownerOnly: true,
            userPermissions: ["MANAGE_ROLES"],
            args: [
                {
                    key: "guildId",
                    prompt: "What is the mutual guild's ID?",
                    type: "string"
                }
            ]
        });
    }

    async run(msg, {guildId}) {
        const guild = this.client.guilds.cache.get(guildId);
	if (!guild) return await msg.failure(`Could not find guild with ID "${guildId}".`);
        const toKick = msg.guild.members.cache.filter(m => m.roles.cache.size == 1 && guild.members.cache.has(m.id));
        const count = toKick.size;
        await msg.info(`Going to kick ${count} members. This will take approximately ${humanReadableUptime(count * 1000)}. Please be patient.`);
        const start = Date.now();
        for (const [, member] of toKick) {
            try {await member.kick("Kicked via purge");}
            catch (e) {await msg.failure(`Unable to kick ${member.user.tag}`);}
        }
        const finish = Date.now();
        await msg.success(`Finished kicking ${count} members. It took ${humanReadableUptime(finish - start)}.`);
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


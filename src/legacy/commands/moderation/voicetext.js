const {Command} = require("discord.js-commando");

module.exports = class extends Command {
    constructor(client) {
        super(client, {
            name: "voicetext",
            group: "moderation",
            memberName: "voicetext",
            description: "Binds a voice and text channel so only those in the voice channel can use the text channel.",
            format: `<cmd> <voice> <text>`,
            guildOnly: true,
            userPermissions: ["MANAGE_GUILD"],
            args: [
                {
                    key: "cmd",
                    prompt: "What action to perform?",
                    type: "string"
                },
                {
                    key: "voice",
                    prompt: "Which voice channel should be bound?",
                    type: "channel"
                },
                {
                    key: "text",
                    prompt: "Which text channel should be bound?",
                    type: "channel"
                }
            ],
        });
    }

    // async onMessage(message) {

    //     // Ignore messages from owner or DMs
    //     if (!message.guild || this.client.isOwner(message.author)) return;

    //     // MANAGE_MESSAGES can bypass this detection
    //     if (message.channel.permissionsFor(message.author).has(["MANAGE_MESSAGES"])) return;

    //     // Check if channel is bound
    //     const pairs = await message.guild.settings.get("voicetext", {});
    //     const boundVoice = pairs[message.channel.id];
    //     if (!boundVoice) return;

    //     // Check if user is in correct vc
    //     const member = message.guild.members.resolve(message.author.id);
    //     const vc = member.voice.channelID;
    //     if (vc === boundVoice) return;

    //     await message.delete({reason: "User not in voice channel"});
    //     const warning = await message.channel.send({content: `${message.author} this channel is only for those in ${boundVoice}.`});
    //     await new Promise(r => setTimeout(r, 5000));
    //     await warning.delete({reason: ""});
    // }

    async onVoiceStateUpdate(oldState, newState) {
        const oldpairs = await oldState.guild.settings.get("voicetext", {});
        const newpairs = await newState.guild.settings.get("voicetext", {});

        // Most common case: they arent in a bound channel, ignore
        const didChange = newState.channelID !== oldState.channelID;
        const isOldChannelBound = oldpairs[oldState.channelID];
        const isNewChannelBound = newpairs[newState.channelID];
        console.log({didChange, isOldChannelBound, isNewChannelBound});
        if (!isOldChannelBound && !isNewChannelBound) return;

        
        

        // User left a bound channel, revoke override perm
        if (isOldChannelBound && didChange) {
            const text = newState.guild.channels.cache.get(isOldChannelBound);
            try {
                await text.permissionOverwrites.get(oldState.id).delete("Left bound text channel");
            }
            catch (err) {
                console.error(err);
            }
        }

        // User joined a bound channel, grant override perm
        if (isNewChannelBound && didChange) {
            const text = newState.guild.channels.cache.get(isNewChannelBound);
            try {
                await text.updateOverwrite(newState.id, {SEND_MESSAGES: true}, "Joined bound text channel");
            }
            catch (err) {
                console.error(err);
            }
        }
    }

    async run(msg, {cmd, voice, text}) {

        if (voice.type == text.type) return await msg.failure("Must have exactly one voice and text channel.");
        if (voice.type == "text" && text.type == "voice") {
            const temp = voice;
            voice = text;
            text = temp;
        }

        if (cmd === "bind") return await this.bind(msg, voice, text);
        else if (cmd === "unbind") return await this.unbind(msg, voice, text);
        else if (cmd === "check") return await this.check(msg, voice, text);
        return await msg.failure("Command not understood. Must be one of: `bind`, `unbind`, `check`");

        // const pairs = await msg.guild.settings.get("voicetext", {});
        // if (channel.id == modlogId) return await msg.failure(`${channel} is already set.`); // Check if setting same channel
        // if (channel.type !== "text") return await msg.failure(`Can only log in text channels.`); // Check for text channel
        // if (!channel.permissionsFor(this.client.user).has(["VIEW_CHANNEL", "SEND_MESSAGES"])) return await msg.failure(`${this.client.user.username} does not have permissions to read/send messages in ${channel}.`); // Permissions check
        // await msg.guild.settings.set("modlog", channel.id);
        // await msg.success(`The modlog is now set to ${channel}.`);        
    }

    async bind(msg, voice, text) {
        const pairs = await msg.guild.settings.get("voicetext", {});
        const current = pairs[voice.id];
        if (current) return await msg.failure(`<#${voice.id}> is already bound to <#${current}>! Please unbind before continuing.`);
        try {
            await text.updateOverwrite(msg.guild.id, {SEND_MESSAGES: false}, "Bind text and voice channel");
        }
        catch (err) {
            console.error(err);
            return await msg.failure(`Unable to adjust permissions for <#${text.id}>. Make sure the bot has permission.`);
        }
        pairs[voice.id] = text.id;
        await msg.guild.settings.set("voicetext", pairs);
        await msg.success(`<#${voice.id}> is now bound to <#${text.id}>!`);
    }

    async unbind(msg, voice, text) {
        const pairs = await msg.guild.settings.get("voicetext", {});
        const current = pairs[voice.id];
        if (!current) return await msg.failure(`<#${voice.id}> is not currently bound!`);
        try {
            await text.updateOverwrite(msg.guild.id, {SEND_MESSAGES: null}, "Unbind text and voice channel");
        }
        catch (err) {
            console.error(err);
            return await msg.failure(`Unable to adjust permissions for <#${text.id}>. Make sure the bot has permission.`);
        }
        delete pairs[voice.id];
        await msg.guild.settings.set("voicetext", pairs);
        await msg.success(`<#${text.id}> is now unbound!`);
    }

    async check(msg, voice) {
        const pairs = await msg.guild.settings.get("voicetext", {});
        const current = pairs[voice.id];
        if (current) return await msg.info(`<#${voice.id}> is bound to <#${current}>!`);
        return await msg.info(`<#${voice.id}> is not currently bound!`);
    }
};
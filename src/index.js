const fs = require("node:fs");
const path = require("node:path");

// Require the necessary discord.js classes
const {Client, Collection, GatewayIntentBits, ActivityType, Partials} = require("discord.js");


// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.DirectMessages
    ],
    partials: [
        Partials.Channel
    ],
    presence: {activities: [{name: "for spam", type: ActivityType.Watching}]}
});


client.commands = new Collection();
// For nested folders
// const commandFolders = fs.readdirSync(path.join(__dirname, "commands")).filter(d => fs.statSync(path.join(__dirname, "commands", d)).isDirectory());
// const commandFiles = commandFolders.map(f => fs.readdirSync(path.join(__dirname, "commands", f)).filter(file => file.endsWith(".js")).map(c => path.join(__dirname, "commands", f, c)));

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
    // For nested folders
    // const command = require(file);
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    // Set a new item in the Collection
    // With the key as the command name and the value as the exported module
    client.commands.set(command.data.name, command);
}


const eventsPath = path.join(__dirname, "events");
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith(".js"));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);

    let events = require(filePath);
    if (!Array.isArray(events)) events = [events];
    
    for (const event of events) {
        if (event.once) client.once(event.name, (...args) => event.execute(...args));
        else client.on(event.name, (...args) => event.execute(...args));
    }
}

client.login(process.env.BOT_TOKEN);

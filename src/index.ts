import fs from "node:fs";
import path from "node:path";
import {ActivityType, Client, Collection, GatewayIntentBits, Partials} from "discord.js";
import type {CommandModule, EventModule} from "./types";
import {pathToFileURL} from "node:url";


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
    presence: {activities: [{name: "Watching for spam", type: ActivityType.Custom}]}
});


client.commands = new Collection<string, CommandModule>();
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".ts"));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = await import(pathToFileURL(filePath).href) as {default: CommandModule;};

    // Handle both default and named exports
    const commandData = "default" in command ? command.default : command;

    // Set a new item in the Collection
    // With the key as the command name and the value as the exported module
    client.commands.set(commandData.data.name, commandData);
}

const eventsPath = path.join(__dirname, "events");
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith(".ts"));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = await import(pathToFileURL(filePath).href) as {default: EventModule;};
    // Handle both default and named exports
    const eventData = event.default || event;
    if (eventData.once) {
        client.once(eventData.name, (...args: Parameters<typeof eventData.execute>) => eventData.execute(...args));
    }
    else {
        client.on(eventData.name, (...args: Parameters<typeof eventData.execute>) => eventData.execute(...args));
    }
}

// Login to Discord with your client's token
await client.login(process.env.BOT_TOKEN);

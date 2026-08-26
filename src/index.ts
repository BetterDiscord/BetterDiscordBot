import path from "node:path";
import {fileURLToPath} from "node:url";
import {ActivityType, Client, GatewayIntentBits, Partials} from "discord.js";
import {Dispatcher, loadCommands, loadEvents} from "./framework";
import {recordCommandRun} from "./util/stats";


const here = path.dirname(fileURLToPath(import.meta.url));

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


// Build the dispatcher up front so a malformed command or a duplicate component
// namespace fails at startup rather than on the first interaction.
const dispatcher = new Dispatcher({
    ownerId: process.env.BOT_OWNER_ID!,
    onCommandRun: recordCommandRun
});

const commands = await loadCommands(path.join(here, "commands"));
for (const command of commands) command.register(dispatcher);

const {commands: migrated, legacy, components} = dispatcher.counts;
console.log(`Loaded ${migrated + legacy} commands (${migrated} migrated, ${legacy} legacy) and ${components} components.`);

client.dispatcher = dispatcher;


const events = await loadEvents(path.join(here, "events"));
for (const event of events) {
    if (event.once) client.once(event.name, (...args) => void event.execute(...args));
    else client.on(event.name, (...args) => void event.execute(...args));
}
console.log(`Registered ${events.length} event listeners.`);


// Login to Discord with your client's token
await client.login(process.env.BOT_TOKEN);

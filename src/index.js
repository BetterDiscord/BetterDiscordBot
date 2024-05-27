const path = require("path");
const sqlite = require("sqlite");
const sqlite3 = require("sqlite3");
const Extensions = require("./ext");
Extensions.addAll();


const Commando = require("discord.js-commando");



const client = new Commando.Client({
    commandPrefix: process.env.BOT_PREFIX,
    owner: process.env.BOT_OWNER_ID,
    fetchAllMembers: process.env.BOT_FETCH_MEMBERS || false,
    description: process.env.BOT_DESCRIPTION,
    invite: process.env.BOT_INVITE
});



client.registry.registerGroups([
    ["botadmin", "Bot Admin"],
    ["meta", "Meta"],
    ["moderation", "Moderation"],
    ["assignableroles", "Assignable Roles"],
]);

client.registry.registerDefaultTypes();
client.registry.registerDefaultGroups();
client.registry.registerDefaultCommands({
    prefix: false,
    help: false, 
    ping: false,
    eval: false,
    unknownCommand: false
});

client.registry.registerCommandsIn(path.join(__dirname, "commands"));

client.setProvider(sqlite.open({driver: sqlite3.Database, filename: path.join(__dirname, "..", "settings.sqlite3")}).then(db => new Commando.SQLiteProvider(db))).catch(console.error);

client.login(process.env.BOT_TOKEN);

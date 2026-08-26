import path from "node:path";
import {fileURLToPath} from "node:url";
import {REST, type RESTPostAPIChatInputApplicationCommandsJSONBody} from "discord.js";
import {API} from "@discordjs/core";
import {loadCommands} from "../src/framework";
import "dotenv/config";


// Check CLI arguments for clear flag
const shouldClear = process.argv.includes("--clear") || process.argv.includes("-c");

// Setup file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a new REST instance
const rest = new REST().setToken(process.env.BOT_TOKEN!);
const api = new API(rest);

async function setCommands(globalCommands: RESTPostAPIChatInputApplicationCommandsJSONBody[], guildCommands: RESTPostAPIChatInputApplicationCommandsJSONBody[]) {
    // Deploy global commands
    try {
        console.log(`\n🚀 Started ${shouldClear ? "clearing" : "registering"} global application commands...`);
        const result = await api.applicationCommands.bulkOverwriteGlobalCommands(process.env.BOT_CLIENT_ID!, globalCommands);
        console.log(`✅ Successfully ${shouldClear ? "cleared" : `registered ${result.length}`} global commands.`);
    }
    catch (error) {
        console.error(`❌ Failed to ${shouldClear ? "clear" : "register"} global commands:`, error);
    }

    // Deploy guild commands (owner commands)
    if (process.env.BOT_GUILD_ID) {
        try {
            console.log(`\n🚀 Started ${shouldClear ? "clearing" : "registering"} guild commands...`);
            const result = await api.applicationCommands.bulkOverwriteGuildCommands(process.env.BOT_CLIENT_ID!, process.env.BOT_GUILD_ID, guildCommands);
            console.log(`✅ Successfully ${shouldClear ? "cleared" : `registered ${result.length}`} guild commands.`);
        }
        catch (error) {
            console.error(`❌ Failed to ${shouldClear ? "clear" : "register"} guild commands:`, error);
        }
    }
    else if (!process.env.BOT_GUILD_ID) {
        console.log(`⚠️  BOT_GUILD_ID not set - skipping owner command ${shouldClear ? "clearing" : "deployment"}`);
    }

    console.log(`\n🎉 Command ${shouldClear ? "clearing" : "deployment"} complete!`);
}

if (!shouldClear) {
    const commands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
    const ownerCommands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];

    // Shared with the bot's own startup path, so what gets deployed is exactly
    // what gets registered. Throws on a malformed module instead of skipping it.
    for (const command of await loadCommands(path.join(__dirname, "..", "src", "commands"))) {
        // Separate owner commands to "privileged" guild
        if (command.ownerOnly) {
            ownerCommands.push(command.data);
            console.log(`🔒 Owner command: ${command.name}`);
        }
        else {
            commands.push(command.data);
            console.log(`🌐 Global command: ${command.name}${command.migrated ? "" : "  (legacy module)"}`);
            if (command.data.integration_types?.includes(1)) console.log(`   📱 User-installable`);
        }
    }

    console.log(`📁 Loaded ${commands.length} global commands and ${ownerCommands.length} owner commands`);
    await setCommands(commands, ownerCommands);
}
else {
    console.log("🗑️  Clearing all commands...");
    await setCommands([], []);
}

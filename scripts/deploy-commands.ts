import {createHash} from "node:crypto";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {REST, type RESTPostAPIChatInputApplicationCommandsJSONBody} from "discord.js";
import {API} from "@discordjs/core";
import {loadCommands} from "../src/framework";
import {globalDB} from "../src/db";
import "dotenv/config";


// Check CLI arguments for clear flag
const shouldClear = process.argv.includes("--clear") || process.argv.includes("-c");
const shouldForce = process.argv.includes("--force") || process.argv.includes("-f");

/**
 * The container runs this on every start, so an unguarded deploy meant a bulk
 * overwrite of every global command on every restart — needless API traffic,
 * and a rate-limit risk during a crash loop. The fingerprint covers what is
 * sent and where, so a redeploy happens exactly when one of those changes.
 */
const FINGERPRINT_KEY = "deployedCommandsFingerprint";

const fingerprintOf = (global: unknown, guild: unknown) => createHash("sha256")
    .update(JSON.stringify({global, guild, clientId: process.env.BOT_CLIENT_ID, guildId: process.env.BOT_GUILD_ID}))
    .digest("hex");

// Setup file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a new REST instance
const rest = new REST().setToken(process.env.BOT_TOKEN!);
const api = new API(rest);

/** Returns whether every part that was attempted succeeded. */
async function setCommands(globalCommands: RESTPostAPIChatInputApplicationCommandsJSONBody[], guildCommands: RESTPostAPIChatInputApplicationCommandsJSONBody[]): Promise<boolean> {
    let ok = true;

    // Deploy global commands
    try {
        console.log(`\n🚀 Started ${shouldClear ? "clearing" : "registering"} global application commands...`);
        const result = await api.applicationCommands.bulkOverwriteGlobalCommands(process.env.BOT_CLIENT_ID!, globalCommands);
        console.log(`✅ Successfully ${shouldClear ? "cleared" : `registered ${result.length}`} global commands.`);
    }
    catch (error) {
        console.error(`❌ Failed to ${shouldClear ? "clear" : "register"} global commands:`, error);
        ok = false;
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
            ok = false;
        }
    }
    else if (!process.env.BOT_GUILD_ID) {
        console.log(`⚠️  BOT_GUILD_ID not set - skipping owner command ${shouldClear ? "clearing" : "deployment"}`);
    }

    console.log(`\n🎉 Command ${shouldClear ? "clearing" : "deployment"} complete!`);
    return ok;
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
            console.log(`🌐 Global command: ${command.name}`);
            if (command.data.integration_types?.includes(1)) console.log(`   📱 User-installable`);
        }
    }

    console.log(`📁 Loaded ${commands.length} global commands and ${ownerCommands.length} owner commands`);

    const fingerprint = fingerprintOf(commands, ownerCommands);
    const deployed = await globalDB.get(FINGERPRINT_KEY);

    if (deployed === fingerprint && !shouldForce) {
        console.log("\n⏭️  Commands are unchanged since the last deploy - skipping. Use --force to deploy anyway.");
    }
    else {
        // Only remember the fingerprint if everything actually landed, so a
        // failed deploy retries on the next start instead of being skipped.
        const ok = await setCommands(commands, ownerCommands);
        if (ok) await globalDB.set(FINGERPRINT_KEY, fingerprint);
        else console.log("⚠️  Not recording the fingerprint; the next run will retry.");
    }
}
else {
    console.log("🗑️  Clearing all commands...");
    await setCommands([], []);
    await globalDB.delete(FINGERPRINT_KEY);
}

import type {ChatInputCommandInteraction} from "discord.js";
import type {CommandStats} from "../types";
import {statsDB} from "../db";


/** Counts a command run against its guild, or against the bot for DMs. */
export async function recordCommandRun(interaction: ChatInputCommandInteraction): Promise<void> {
    const key = interaction.guildId ?? interaction.client.user.id;
    const name = interaction.commandName;

    const data: CommandStats = await statsDB.get(key) ?? {commands: {}};
    data.commands ??= {};
    data.commands[name] = (data.commands[name] ?? 0) + 1;

    await statsDB.set(key, data);
}

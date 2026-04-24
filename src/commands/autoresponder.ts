import {AutocompleteInteraction, ChatInputCommandInteraction, EmbedBuilder, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder} from "discord.js";
import {autoresponderDB, guildDB} from "../db";
import Messages from "../util/messages";
import Colors from "../util/colors";


export default {
    data: new SlashCommandBuilder()
        .setName("autoresponder")
        .setDescription("Manage automatic responses to keywords.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .setContexts(InteractionContextType.Guild)
        .addSubcommand(c =>
            c.setName("toggle").setDescription("Enable or disable the autoresponder module.")
                .addBooleanOption(opt =>
                    opt.setName("enable").setDescription("Enable or disable")
                )
        )
        .addSubcommand(c =>
            c.setName("add").setDescription("Add an auto-response trigger.")
                .addStringOption(opt =>
                    opt.setName("trigger").setDescription("The keyword or phrase to trigger on.").setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName("response").setDescription("The response to send.").setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName("match_type").setDescription("How to match the trigger. Default: contains.")
                        .addChoices(
                            {name: "Contains", value: "contains"},
                            {name: "Exact Match", value: "exact"},
                            {name: "Starts With", value: "startsWith"},
                        )
                )
        )
        .addSubcommand(c =>
            c.setName("remove").setDescription("Remove an auto-response trigger.")
                .addStringOption(opt =>
                    opt.setName("trigger").setDescription("The trigger to remove.").setRequired(true).setAutocomplete(true)
                )
        )
        .addSubcommand(c =>
            c.setName("list").setDescription("List all auto-response triggers.")
        ),


    async execute(interaction: ChatInputCommandInteraction<"cached">) {
        const command = interaction.options.getSubcommand();
        if (command === "toggle") return await this.toggle(interaction);
        if (command === "add") return await this.add(interaction);
        if (command === "remove") return await this.remove(interaction);
        if (command === "list") return await this.list(interaction);
    },


    async toggle(interaction: ChatInputCommandInteraction<"cached">) {
        const toEnable = interaction.options.getBoolean("enable");
        const current = await guildDB.get(interaction.guild.id) ?? {};
        if (toEnable === null) return await interaction.reply(Messages.info(`Autoresponder is currently ${current.autoresponder ? "enabled" : "disabled"}.`, {ephemeral: true}));

        current.autoresponder = toEnable;
        await guildDB.set(interaction.guild.id, current);
        await interaction.reply(Messages.success(`Autoresponder has been ${toEnable ? "enabled" : "disabled"}.`, {ephemeral: true}));
    },


    async add(interaction: ChatInputCommandInteraction<"cached">) {
        const trigger = interaction.options.getString("trigger", true).toLowerCase();
        const response = interaction.options.getString("response", true);
        const matchType = (interaction.options.getString("match_type") ?? "contains") as "exact" | "contains" | "startsWith";

        const current = await autoresponderDB.get(interaction.guild.id) ?? [];
        if (current.some(e => e.trigger === trigger)) {
            return await interaction.reply(Messages.error(`A trigger for \`${trigger}\` already exists. Remove it first to update.`, {ephemeral: true}));
        }

        current.push({trigger, response, matchType});
        await autoresponderDB.set(interaction.guild.id, current);
        await interaction.reply(Messages.success(`Auto-response added for trigger: \`${trigger}\` (match: ${matchType})`, {ephemeral: true}));
    },


    async remove(interaction: ChatInputCommandInteraction<"cached">) {
        const trigger = interaction.options.getString("trigger", true).toLowerCase();
        const current = await autoresponderDB.get(interaction.guild.id) ?? [];
        const index = current.findIndex(e => e.trigger === trigger);

        if (index === -1) return await interaction.reply(Messages.error(`No trigger found for \`${trigger}\`.`, {ephemeral: true}));

        current.splice(index, 1);
        await autoresponderDB.set(interaction.guild.id, current);
        await interaction.reply(Messages.success(`Auto-response removed for trigger: \`${trigger}\``, {ephemeral: true}));
    },


    async list(interaction: ChatInputCommandInteraction<"cached">) {
        await interaction.deferReply({ephemeral: true});
        const current = await autoresponderDB.get(interaction.guild.id) ?? [];
        if (!current.length) return await interaction.editReply(Messages.info("No auto-responses configured for this server."));

        const description = current
            .map(e => `**\`${e.trigger}\`** (${e.matchType})\n↳ ${e.response.substring(0, 80)}${e.response.length > 80 ? "…" : ""}`)
            .join("\n\n");

        const embed = new EmbedBuilder()
            .setColor(Colors.Info)
            .setTitle("Auto-Responses")
            .setDescription(description);

        await interaction.editReply({embeds: [embed]});
    },


    async autocomplete(interaction: AutocompleteInteraction<"cached">) {
        const focused = interaction.options.getFocused().toLowerCase();
        const current = await autoresponderDB.get(interaction.guildId) ?? [];
        const filtered = current.filter(e => e.trigger.startsWith(focused)).slice(0, 25);
        await interaction.respond(filtered.map(e => ({name: e.trigger, value: e.trigger})));
    },
};

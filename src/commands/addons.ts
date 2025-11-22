import {ApplicationIntegrationType, AutocompleteInteraction, ChatInputCommandInteraction, InteractionContextType, MessageFlags, SlashCommandBuilder, type AutocompleteFocusedOption} from "discord.js";
import Messages from "../util/messages";
import type {BdWebAddon, BdWebTag} from "../types";
import Similarity from "string-similarity";
import Web from "../util/web";
import Paginator from "../paginator";
import {cache, ensureCache, createAddonComponent, paginateAddonPages, sortAddons, createAddonList} from "../util/addons";


const TAG_CHOICES = [...Web.store.tags.plugin, ...Web.store.tags.theme];

export default {
    data: new SlashCommandBuilder()
        .setName("addons")
        .setDescription("Commands for addons.")
        .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
        .addSubcommand(c => c.setName("updated").setDescription("Shows the most recently updated addons"))
        .addSubcommand(c => c.setName("newest").setDescription("Shows the newest added addons"))
        .addSubcommand(c => c.setName("top").setDescription("Shows the most liked addons"))
        .addSubcommand(c => c.setName("popular").setDescription("Shows the most downloaded addons"))
        .addSubcommand(c => c.setName("random").setDescription("Shows a random addon"))
        .addSubcommand(c => c.setName("search").setDescription("Searches for an addon by name")
            .addStringOption(opt => opt.setName("name").setDescription("Name of the addon to find").setRequired(true).setAutocomplete(true))
        )
        .addSubcommand(c => c.setName("info").setDescription("Gets information about an addon")
            .addStringOption(opt => opt.setName("name").setDescription("Name of the addon to get info about").setRequired(true).setAutocomplete(true))
        )
        .addSubcommand(c => c.setName("browse").setDescription("Browse addons in an interactive way")
            .addStringOption(opt =>
                opt.setName("tag").setDescription("tag to browse").setRequired(false).setAutocomplete(true)
            )
            .addStringOption(opt =>
                opt.setName("type").setDescription("type to browse").setRequired(false).addChoices(
                    {name: "Plugin", value: "plugin"},
                    {name: "Theme", value: "theme"},
                )
            )
            .addStringOption(opt =>
                opt.setName("sort").setDescription("sort method").setRequired(false).addChoices(
                    {name: "Newest", value: "initial_release_date"},
                    {name: "Last Updated", value: "latest_release_date"},
                    {name: "Most Liked", value: "likes"},
                    {name: "Popular", value: "downloads"},
                )
            )
        ),

    /**
     * Main function for addons command
     */
    async execute(interaction: ChatInputCommandInteraction<"cached">) {
        await interaction.deferReply();
        await ensureCache();
        const command = interaction.options.getSubcommand();
        if (command === "search") return await this.search(interaction);
        if (command === "browse") return await this.browse(interaction);
        if (command === "updated") return await this.top10(interaction, "latest_release_date");
        if (command === "newest") return await this.top10(interaction, "initial_release_date");
        if (command === "top") return await this.top10(interaction, "likes");
        if (command === "popular") return await this.top10(interaction, "downloads");
        if (command === "random") return await this.random(interaction);
        if (command === "info") return await this.info(interaction);

        return await interaction.editReply(Messages.error("This command is not yet implemented."));
    },

    /**
     * Complex commands
     */

    async browse(interaction: ChatInputCommandInteraction<"cached">) {
        const tag = interaction.options.getString("tag");
        const type = interaction.options.getString("type");
        const sort = interaction.options.getString("sort") || "downloads";

        const filteredAddons = Array.from(cache).filter(addon => {
            if (tag && !addon.tags.includes(tag as BdWebTag)) return false;
            if (type && addon.type !== type) return false;
            return true;
        });

        // No need to continue if there are no results
        if (filteredAddons.length === 0) return await interaction.editReply(Messages.error("No addons found with the specified criteria."));

        sortAddons(filteredAddons, sort as "likes" | "downloads" | "initial_release_date" | "latest_release_date");

        const title: string[] = [];
        title.push(type ? type.charAt(0).toUpperCase() + type.slice(1) + "s" : "Addons");
        if (tag) title.push(`with tag \`${tag}\``);
        title.push(`sorted by ${sort.replace(/_/g, " ")}`);

        const paginator = new Paginator<BdWebAddon>({
            interaction,
            items: filteredAddons,
            itemsPerPage: 3,
            renderPage: addons => createAddonList(`${title.join(" ")}`, addons),
        });

        await paginator.paginate();
    },

    async search(interaction: ChatInputCommandInteraction<"cached">) {
        const name = interaction.options.getString("name", true).toLowerCase();
        let results: BdWebAddon[] = [];
        for (const addon of cache) {
            if (addon.name.toLowerCase().includes(name) || (addon.description?.toLowerCase().includes(name))) {
                results.push(addon);
            }
        }

        results = Similarity.findBestMatch(name, results.map(a => a.name)).ratings
            .sort((a, b) => b.rating - a.rating)
            .slice(0, 10)
            .map(rating => results.find(a => a.name === rating.target)!)
            .filter(a => !!a);

        await paginateAddonPages(interaction, results);
    },

    /**
     * Simple commands
     */

    async top10(interaction: ChatInputCommandInteraction<"cached">, sortBy: "likes" | "downloads" | "initial_release_date" | "latest_release_date") {
        await paginateAddonPages(interaction, sortAddons(Array.from(cache), sortBy).slice(0, 10));
    },

    async random(interaction: ChatInputCommandInteraction<"cached">) {
        const addonsArray = Array.from(cache);
        const randomAddon = addonsArray[Math.floor(Math.random() * addonsArray.length)];
        return await interaction.editReply({components: [createAddonComponent(randomAddon)], flags: MessageFlags.IsComponentsV2});
    },

    async info(interaction: ChatInputCommandInteraction<"cached">) {
        const name = interaction.options.getString("name", true).toLowerCase();
        const addon = Array.from(cache).find(a => a.name.toLowerCase() === name);
        if (!addon) return await interaction.editReply(Messages.error("No addon found with that name."));
        return await interaction.editReply({components: [createAddonComponent(addon)], flags: MessageFlags.IsComponentsV2});
    },


    /**
     * Autocomplete handlers for tags and addon names
     */

    async autocomplete(interaction: AutocompleteInteraction<"cached">) {
        await ensureCache();
        const focusedValue = interaction.options.getFocused(true);
        if (focusedValue.name === "name") return await this.autocompleteName(interaction, focusedValue);
        if (focusedValue.name === "tag") return await this.autocompleteTag(interaction, focusedValue);
    },

    async autocompleteName(interaction: AutocompleteInteraction<"cached">, focused: AutocompleteFocusedOption) {
        const names = Array.from(cache).map(addon => addon.name);
        if (focused.value.length === 0) {
            const results = names.slice(0, 25).map(name => ({name, value: name}));
            return await interaction.respond(results);
        }

        const results = Similarity.findBestMatch(focused.value, names).ratings
            .sort((a, b) => b.rating - a.rating)
            .slice(0, 25)
            .map(rating => ({name: rating.target, value: rating.target}));

        await interaction.respond(results);
    },

    async autocompleteTag(interaction: AutocompleteInteraction<"cached">, focused: AutocompleteFocusedOption) {
        if (focused.value.length === 0) {
            const results = TAG_CHOICES.slice(0, 25).map(name => ({name, value: name}));
            return await interaction.respond(results);
        }

        const results = Similarity.findBestMatch(focused.value, TAG_CHOICES).ratings
            .sort((a, b) => b.rating - a.rating)
            .slice(0, 25)
            .map(rating => ({name: rating.target, value: rating.target}));

        await interaction.respond(results);
    },
};


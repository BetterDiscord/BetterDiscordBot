import {ApplicationCommandOptionType, ApplicationCommandType, ApplicationIntegrationType, AutocompleteInteraction, ChatInputCommandInteraction, InteractionContextType, MessageFlags, type AutocompleteFocusedOption} from "discord.js";
import {defineCommand} from "../framework";
import * as notices from "../util/notices";
import type {BdWebAddon, BdWebTag} from "../types";
import Similarity from "string-similarity";
import Web from "../util/web";
import {paginate} from "../paginator";
import {cache, ensureCache, createAddonComponent, paginateAddonPages, sortAddons, createAddonList} from "../util/addons";


const TAG_CHOICES = [...Web.store.tags.plugin, ...Web.store.tags.theme];

/**
     * Main function for addons command
     */


async function browse(interaction: ChatInputCommandInteraction) {
    const tag = interaction.options.getString("tag");
    const type = interaction.options.getString("type");
    const sort = interaction.options.getString("sort") || "downloads";

    const filteredAddons = Array.from(cache).filter(addon => {
        if (tag && !addon.tags.includes(tag as BdWebTag)) return false;
        if (type && addon.type !== type) return false;
        return true;
    });

    // No need to continue if there are no results
    if (filteredAddons.length === 0) return await interaction.editReply(notices.error("No addons found with the specified criteria."));

    sortAddons(filteredAddons, sort as "likes" | "downloads" | "initial_release_date" | "latest_release_date");

    const title: string[] = [];
    title.push(type ? type.charAt(0).toUpperCase() + type.slice(1) + "s" : "Addons");
    if (tag) title.push(`with tag \`${tag}\``);
    title.push(`sorted by ${sort.replace(/_/g, " ")}`);

    await paginate<BdWebAddon>({
        interaction,
        items: filteredAddons,
        perPage: 3,
        renderPage: addons => createAddonList(title.join(" "), addons),
    });
}

async function search(interaction: ChatInputCommandInteraction) {
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
}


async function top10(interaction: ChatInputCommandInteraction, sortBy: "likes" | "downloads" | "initial_release_date" | "latest_release_date") {
    await paginateAddonPages(interaction, sortAddons(Array.from(cache), sortBy).slice(0, 10));
}

async function random(interaction: ChatInputCommandInteraction) {
    const addonsArray = Array.from(cache);
    const randomAddon = addonsArray[Math.floor(Math.random() * addonsArray.length)];
    return await interaction.editReply({components: [createAddonComponent(randomAddon)], flags: MessageFlags.IsComponentsV2});
}

async function info(interaction: ChatInputCommandInteraction) {
    const name = interaction.options.getString("name", true).toLowerCase();
    const addon = Array.from(cache).find(a => a.name.toLowerCase() === name);
    if (!addon) return await interaction.editReply(notices.error("No addon found with that name."));
    return await interaction.editReply({components: [createAddonComponent(addon)], flags: MessageFlags.IsComponentsV2});
}



async function autocomplete(interaction: AutocompleteInteraction) {
    await ensureCache();
    const focusedValue = interaction.options.getFocused(true);
    if (focusedValue.name === "name") return await autocompleteName(interaction, focusedValue);
    if (focusedValue.name === "tag") return await autocompleteTag(interaction, focusedValue);
}

async function autocompleteName(interaction: AutocompleteInteraction, focused: AutocompleteFocusedOption) {
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
}

async function autocompleteTag(interaction: AutocompleteInteraction, focused: AutocompleteFocusedOption) {
    if (focused.value.length === 0) {
        const results = TAG_CHOICES.slice(0, 25).map(name => ({name, value: name}));
        return await interaction.respond(results);
    }

    const results = Similarity.findBestMatch(focused.value, TAG_CHOICES).ratings
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 25)
        .map(rating => ({name: rating.target, value: rating.target}));

    await interaction.respond(results);
}


const nameOpt = (description: string) => ({
    type: ApplicationCommandOptionType.String as const,
    name: "name",
    description,
    required: true,
    autocomplete: true
});

const simple = (name: string, description: string) => ({
    type: ApplicationCommandOptionType.Subcommand as const,
    name,
    description
});


export const command = defineCommand({
    data: {
        type: ApplicationCommandType.ChatInput,
        name: "addons",
        description: "Commands for addons.",
        contexts: [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel],
        integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall],
        options: [
            simple("updated", "Shows the most recently updated addons"),
            simple("newest", "Shows the newest added addons"),
            simple("top", "Shows the most liked addons"),
            simple("popular", "Shows the most downloaded addons"),
            simple("random", "Shows a random addon"),
            {...simple("search", "Searches for an addon by name"), options: [nameOpt("Name of the addon to find")]},
            {...simple("info", "Gets information about an addon"), options: [nameOpt("Name of the addon to get info about")]},
            {
                ...simple("browse", "Browse addons in an interactive way"),
                options: [
                    {
                        type: ApplicationCommandOptionType.String as const,
                        name: "tag",
                        description: "tag to browse",
                        required: false,
                        autocomplete: true
                    },
                    {
                        type: ApplicationCommandOptionType.String as const,
                        name: "type",
                        description: "type to browse",
                        required: false,
                        choices: [{name: "Plugin", value: "plugin"}, {name: "Theme", value: "theme"}]
                    },
                    {
                        type: ApplicationCommandOptionType.String as const,
                        name: "sort",
                        description: "sort method",
                        required: false,
                        choices: [
                            {name: "Newest", value: "initial_release_date"},
                            {name: "Last Updated", value: "latest_release_date"},
                            {name: "Most Liked", value: "likes"},
                            {name: "Popular", value: "downloads"}
                        ]
                    }
                ]
            }
        ]
    },

    async execute(interaction) {
        await interaction.deferReply();
        await ensureCache();
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === "search") return await search(interaction);
        if (subcommand === "browse") return await browse(interaction);
        if (subcommand === "updated") return await top10(interaction, "latest_release_date");
        if (subcommand === "newest") return await top10(interaction, "initial_release_date");
        if (subcommand === "top") return await top10(interaction, "likes");
        if (subcommand === "popular") return await top10(interaction, "downloads");
        if (subcommand === "random") return await random(interaction);
        if (subcommand === "info") return await info(interaction);

        return await interaction.editReply(notices.error("This command is not yet implemented."));
    },

    autocomplete
});

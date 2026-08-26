import {
    ButtonStyle, ChatInputCommandInteraction, ComponentType, MessageFlags, SeparatorSpacingSize,
    StringSelectMenuInteraction,
    type ActionRowData, type ComponentInContainerData, type ContainerComponentData,
    type MessageActionRowComponentData, type SectionComponentData, type TextDisplayComponentData
} from "discord.js";
import {container, row, text} from "../framework";
import type {BdWebAddon} from "../types";

import Web from "../util/web";
import {globalDB} from "../db";
import {request} from "undici";
import {msInHour, msInMinute} from "./time";


export const cache = new Set<BdWebAddon>();

/** De-duplicates concurrent refreshes so two commands don't both hit the store. */
let inFlight: Promise<void> | null = null;

async function loadFromStorage(): Promise<void> {
    console.log("Loading addon cache from storage...");
    const storedCache = await globalDB.get("addonCache") as BdWebAddon[] ?? [];
    for (const addon of storedCache) {
        cache.add(addon);
    }
}

async function refreshFromStore(): Promise<void> {
    console.log(cache.size ? "Refreshing" : "Building", "addon cache...");

    // Fetch everything before touching what we already have. The previous
    // version cleared the cache and stamped the timestamp up front, so a failed
    // request left an empty cache that would not retry for an hour.
    const fetched: BdWebAddon[] = [];
    for (const url of [Web.store.plugins, Web.store.themes]) {
        const res = await request(url);
        fetched.push(...await res.body.json() as BdWebAddon[]);
    }

    cache.clear();
    for (const addon of fetched) {
        cache.add(addon);
    }

    await globalDB.set("addonCache", fetched);
    await globalDB.set("addonCacheLastUpdate", Date.now());
    console.log(`Cached ${cache.size} addons from store.`);
}

export async function ensureCache() {
    const previousCacheUpdate = await globalDB.get("addonCacheLastUpdate") as number ?? 0;
    if ((Date.now() - previousCacheUpdate) < msInHour) {
        if (cache.size) return;
        return await loadFromStorage();
    }

    try {
        inFlight ??= refreshFromStore().finally(() => {inFlight = null;});
        await inFlight;
    }
    catch (error) {
        // The timestamp was not advanced, so the next call retries. Serve
        // whatever we have rather than failing the command outright.
        console.error("Could not refresh addon cache:", error);
        if (!cache.size) await loadFromStorage();
    }
}


export function sortAddons(addons: BdWebAddon[], sortBy: "likes" | "downloads" | "initial_release_date" | "latest_release_date"): BdWebAddon[] {
    return addons.sort((a, b) => {
        if (sortBy === "initial_release_date" || sortBy === "latest_release_date") {
            return new Date(b[sortBy]).getTime() - new Date(a[sortBy]).getTime();
        }
        return b[sortBy] - a[sortBy];
    });
}


const separator = (spacing: SeparatorSpacingSize, divider: boolean): ComponentInContainerData =>
    ({type: ComponentType.Separator, spacing, divider});

const thumbnail = (url: string) => ({type: ComponentType.Thumbnail as const, media: {url}});

/** The link buttons every addon carries, plus a support server when there is one. */
function addonLinks(addon: BdWebAddon): MessageActionRowComponentData[] {
    const buttons: MessageActionRowComponentData[] = [
        {type: ComponentType.Button, style: ButtonStyle.Link, label: "View Online", url: Web.pages[addon.type](addon.name)},
        {type: ComponentType.Button, style: ButtonStyle.Link, label: "Download Now", url: Web.redirects.download(addon.id.toString())}
    ];

    if (addon.author.guild?.invite_link) {
        buttons.push({type: ComponentType.Button, style: ButtonStyle.Link, label: "Support Server", url: addon.author.guild.invite_link});
    }

    return buttons;
}


/** One addon rendered in full, as its own page. */
export function createAddonComponent(addon: BdWebAddon): ContainerComponentData {
    const details: TextDisplayComponentData[] = [
        {type: ComponentType.TextDisplay, content: `# ${addon.name} v${addon.version}`},
        {type: ComponentType.TextDisplay, content: addon.description ?? "No description provided."},
        {type: ComponentType.TextDisplay, content: addon.tags.map(tag => `\`${tag}\``).join(" ")}
    ];

    return container([
        {
            type: ComponentType.Section,
            components: details,
            accessory: thumbnail(Web.resources.thumbnail(addon.thumbnail_url))
        },
        separator(SeparatorSpacingSize.Small, false),
        text(`👍  ${addon.likes.toLocaleString()} Likes         ⬇️  ${addon.downloads.toLocaleString()} Downloads`),
        separator(SeparatorSpacingSize.Large, true),
        row(...addonLinks(addon)),
        text(`-# Updated ${new Date(addon.latest_release_date).toLocaleDateString()} • Released ${new Date(addon.initial_release_date).toLocaleDateString()}`)
    ]);
}


/** One addon as a compact row within a list. */
export function createAddonSection(addon: BdWebAddon): SectionComponentData {
    const links = [
        `[View Online](${Web.pages[addon.type](addon.name)})`,
        `[Download Now](${Web.redirects.download(addon.id.toString())})`,
        addon.author.guild?.invite_link && `[Support Server](${addon.author.guild.invite_link})`
    ].filter(Boolean).join("  •  ");

    return {
        type: ComponentType.Section,
        components: [
            {type: ComponentType.TextDisplay, content: `### ${addon.name}`},
            {type: ComponentType.TextDisplay, content: addon.description ?? "No description provided."},
            {type: ComponentType.TextDisplay, content: links}
        ],
        accessory: thumbnail(Web.resources.thumbnail(addon.thumbnail_url))
    };
}


export function createAddonList(title: string, addons: BdWebAddon[]): [TextDisplayComponentData, ContainerComponentData] {
    const body: ComponentInContainerData[] = [];
    for (const [index, addon] of addons.entries()) {
        body.push(createAddonSection(addon));
        if (index < addons.length - 1) body.push(separator(SeparatorSpacingSize.Large, true));
    }

    return [{type: ComponentType.TextDisplay, content: `## ${title}`}, container(body)];
}


export function createNavigation(addons: BdWebAddon[], selectedIndex = 0, disabled = false): ActionRowData<MessageActionRowComponentData> {
    return row({
        type: ComponentType.StringSelect,
        customId: "addons-navigation",
        disabled,
        options: addons.map((addon, index) => ({
            "label": `${index + 1}. ${addon.name}`,
            "value": addon.name,
            "default": index === selectedIndex
        }))
    });
}


export async function paginateAddonPages(interaction: ChatInputCommandInteraction, addons: BdWebAddon[]) {
    const navigation = createNavigation(addons);
    const pages = addons.map(addon => createAddonComponent(addon));

    const msg = await interaction.fetchReply();
    const collector = msg.createMessageComponentCollector({time: 5 * msInMinute});

    let selectedIndex = 0;
    collector.on("collect", async (i: StringSelectMenuInteraction) => {
        if (i.user.id !== interaction.user.id) return await i.reply({content: "You cannot interact with this menu.", flags: MessageFlags.Ephemeral});

        const selectedAddonName = i.values[0];
        const selectedAddon = addons.find(a => a.name === selectedAddonName)!;
        selectedIndex = addons.indexOf(selectedAddon);
        const newPage = pages[selectedIndex];
        const newNavigation = createNavigation(addons, selectedIndex);
        await i.update({components: [newNavigation, newPage], flags: MessageFlags.IsComponentsV2});
    });

    collector.on("end", async () => {
        await interaction.editReply({components: [createNavigation(addons, selectedIndex, true), pages[selectedIndex]], flags: MessageFlags.IsComponentsV2});
    });

    await interaction.editReply({components: [navigation, pages[0]], flags: MessageFlags.IsComponentsV2});
}
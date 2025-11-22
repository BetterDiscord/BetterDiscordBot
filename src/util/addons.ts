import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ContainerBuilder, MessageFlags, SectionBuilder, SeparatorBuilder, SeparatorSpacingSize, StringSelectMenuBuilder, StringSelectMenuInteraction, StringSelectMenuOptionBuilder, TextDisplayBuilder, ThumbnailBuilder} from "discord.js";
import type {BdWebAddon} from "../types";

import Web from "../util/web";
import {globalDB} from "../db";
import {request} from "undici";
import {msInHour, msInMinute} from "./time";


export const cache = new Set<BdWebAddon>();
export async function ensureCache() {
    const previousCacheUpdate = await globalDB.get("addonCacheLastUpdate") as number ?? 0;
    if ((Date.now() - previousCacheUpdate) < msInHour) {
        if (cache.size) return;
        console.log("Loading addon cache from storage...");
        const storedCache = await globalDB.get("addonCache") as BdWebAddon[] ?? [];
        for (const addon of storedCache) {
            cache.add(addon);
        }
        return;
    }
    console.log(cache.size ? "Refreshing" : "Building", "addon cache...");
    await globalDB.set("addonCacheLastUpdate", Date.now());

    // Clear previous cache in DB and in-memory
    await globalDB.set("addonCache", []);
    cache.clear();

    let res = await request(Web.store.plugins);
    let data = await res.body.json() as BdWebAddon[];
    for (const addon of data) {
        cache.add(addon);
    }

    res = await request(Web.store.themes);
    data = await res.body.json() as BdWebAddon[];
    for (const addon of data) {
        cache.add(addon);
    }

    await globalDB.set("addonCache", Array.from(cache));
    console.log(`Cached ${cache.size} addons from store.`);
}


export function sortAddons(addons: BdWebAddon[], sortBy: "likes" | "downloads" | "initial_release_date" | "latest_release_date"): BdWebAddon[] {
    return addons.sort((a, b) => {
        if (sortBy === "initial_release_date" || sortBy === "latest_release_date") {
            return new Date(b[sortBy]).getTime() - new Date(a[sortBy]).getTime();
        }
        return b[sortBy] - a[sortBy];
    });
}


export function createAddonComponent(addon: BdWebAddon) {

    const buttons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setLabel("View Online")
                .setURL(Web.pages[addon.type](addon.name)),
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setLabel("Download Now")
                .setURL(Web.redirects.download(addon.id.toString())),
        );

    if (addon.author.guild?.invite_link) {
        buttons.addComponents(
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setLabel("Support Server")
                .setURL(addon.author.guild.invite_link),
        );
    }

    const page = new ContainerBuilder()
        .addSectionComponents(
            new SectionBuilder()
                .setThumbnailAccessory(
                    new ThumbnailBuilder().setURL(Web.resources.thumbnail(addon.thumbnail_url))
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`# ${addon.name} v${addon.version}`),
                    new TextDisplayBuilder().setContent(addon.description ?? "No description provided."),
                    new TextDisplayBuilder().setContent(addon.tags.map(tag => `\`${tag}\``).join(" ")),
                ),
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`👍  ${addon.likes.toLocaleString()} Likes         ⬇️  ${addon.downloads.toLocaleString()} Downloads`))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true))
        .addActionRowComponents(buttons)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Updated ${new Date(addon.latest_release_date).toLocaleDateString()} • Released ${new Date(addon.initial_release_date).toLocaleDateString()}`));

    return page;
}

export function createAddonSection(addon: BdWebAddon) {

    const links = [
        `[View Online](${Web.pages[addon.type](addon.name)})`,
        `[Download Now](${Web.redirects.download(addon.id.toString())})`,
        addon.author.guild?.invite_link && `[Support Server](${addon.author.guild?.invite_link})`
    ].filter(Boolean).join("  •  ");

    const section = new SectionBuilder()
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(Web.resources.thumbnail(addon.thumbnail_url)))
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### ${addon.name}`),
            new TextDisplayBuilder().setContent(addon.description ?? "No description provided."),
            new TextDisplayBuilder().setContent(links),
        );

    return section;
}

export function createAddonList(title: string, addons: BdWebAddon[]) {
    const page = new ContainerBuilder();
    for (const [index, addon] of addons.entries()) {
        page.addSectionComponents(createAddonSection(addon));
        if (index < addons.length - 1) page.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true));
    }
    return [new TextDisplayBuilder().setContent(`## ${title}`), page];
}

export function createNavigation(addons: BdWebAddon[], selectedIndex = 0, disabled = false) {
    const navigation = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId(`addons-navigation`).addOptions(
            ...addons.map((addon, index) => new StringSelectMenuOptionBuilder().setLabel(`${index + 1}. ${addon.name}`).setValue(addon.name).setDefault(index === selectedIndex))
        )
            .setDisabled(disabled)
    );
    return navigation;
}


export async function paginateAddonPages(interaction: ChatInputCommandInteraction<"cached">, addons: BdWebAddon[]) {
    const navigation = createNavigation(addons);
    const pages = addons.map(addon => createAddonComponent(addon));

    const msg = await interaction.fetchReply();
    const collector = msg.createMessageComponentCollector({time: 5 * msInMinute});

    let selectedIndex = 0;
    collector.on("collect", async (i: StringSelectMenuInteraction<"cached">) => {
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
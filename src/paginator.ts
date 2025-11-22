import {ActionRowBuilder, ButtonBuilder, ButtonStyle, CommandInteraction, ButtonInteraction, type JSONEncodable, type APIMessageTopLevelComponent, MessageFlags} from "discord.js";
import {msInMinute} from "./util/time";


interface PaginatorOptions<T> {
    interaction: CommandInteraction;
    items: T[];
    renderPage: (items: T[], page?: number, totalPages?: number) => JSONEncodable<APIMessageTopLevelComponent> | Array<JSONEncodable<APIMessageTopLevelComponent>>;
    itemsPerPage?: number;
    timeout?: number;
}

export default class Paginator<T = unknown> {
    private interaction: CommandInteraction;
    private entries: T[];
    private itemsPerPage: number;
    private timeout: number;
    private renderPage: PaginatorOptions<T>["renderPage"];
    private pages: Array<JSONEncodable<APIMessageTopLevelComponent> | Array<JSONEncodable<APIMessageTopLevelComponent>>> = [];

    private numPages: number;
    private currentPage: number = 1;
    private buttonInteraction?: ButtonInteraction;

    constructor(options: PaginatorOptions<T>) {
        this.interaction = options.interaction;
        this.entries = options.items;
        this.itemsPerPage = options.itemsPerPage || 10;
        this.timeout = options.timeout || msInMinute * 2;
        this.renderPage = options.renderPage;
        this.numPages = Math.floor(this.entries.length / this.itemsPerPage);
        if (this.entries.length % this.itemsPerPage) this.numPages = this.numPages + 1;

        for (let i = 1; i <= this.numPages; i++) {
            const pageEntries = this.getEntriesForPage(i);
            this.pages.push(this.renderPage(pageEntries, i, this.numPages));
        }
    }

    get buttons() {
        return new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("first")
                    .setLabel("<< First")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(this.currentPage === 1),
                new ButtonBuilder()
                    .setCustomId("previous")
                    .setLabel("< Previous")
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(this.currentPage === 1),
                new ButtonBuilder()
                    .setCustomId("page-info")
                    .setLabel(`Page ${this.currentPage} of ${this.numPages}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId("next")
                    .setLabel("Next >")
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(this.currentPage === this.numPages),
                new ButtonBuilder()
                    .setCustomId("last")
                    .setLabel("Last >>")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(this.currentPage === this.numPages),
            );
    }

    getEntriesForPage(page: number): T[] {
        const base = (page - 1) * this.itemsPerPage;
        return this.entries.slice(base, base + this.itemsPerPage);
    }

    async firstPage() {await this.showPage(1);}
    async lastPage() {await this.showPage(this.numPages);}
    async nextPage() {await this.validatedShowPage(this.currentPage + 1);}
    async previousPage() {await this.validatedShowPage(this.currentPage - 1);}
    async validatedShowPage(page: number) {
        if (page > 0 && page <= this.numPages) await this.showPage(page);
    }

    async showPage(page: number) {
        this.currentPage = page;

        const renderedPage = this.pages[this.currentPage - 1];
        const componentList = Array.isArray(renderedPage) ? renderedPage : [renderedPage];

        if (this.buttonInteraction) return await this.buttonInteraction.update({components: [...componentList, this.buttons], flags: MessageFlags.IsComponentsV2});
        await this.interaction.editReply({components: [...componentList, this.buttons], flags: MessageFlags.IsComponentsV2});
    }

    async paginate() {
        await this.showPage(1);

        const msg = await this.interaction.fetchReply();
        const collector = msg.createMessageComponentCollector({time: this.timeout});

        collector.on("collect", async i => {
            this.buttonInteraction = i as ButtonInteraction;
            if (i.user.id !== this.interaction.user.id) return await i.reply({content: "You cannot interact with this menu.", flags: MessageFlags.Ephemeral});
            if (i.customId === "first") await this.firstPage();
            if (i.customId === "last") await this.lastPage();
            if (i.customId === "previous") await this.previousPage();
            if (i.customId === "next") await this.nextPage();
            if (i.customId === "page-info") await i.reply({content: `You are on page ${this.currentPage} of ${this.numPages}.`, flags: MessageFlags.Ephemeral});
        });

        collector.on("end", async () => {
            const renderedPage = this.pages[this.currentPage - 1];
            const componentList = Array.isArray(renderedPage) ? renderedPage : [renderedPage];
            await this.interaction.editReply({components: componentList});
        });
    }
}

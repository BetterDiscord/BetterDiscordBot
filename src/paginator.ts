/**
 * Button pagination, built on `runSession`.
 *
 * The ownership check, the timeout and disabling the controls when the collector
 * ends are no longer this file's concern — they happen once, in
 * `src/framework/session.ts`, which is why the previous version's two bugs
 * (capturing the button interaction before the user check, and dropping
 * `IsComponentsV2` on the final edit) are no longer expressible here.
 */

import {
    ButtonStyle, ComponentType, MessageFlags,
    type InteractionEditReplyOptions, type MessageActionRowComponentData, type RepliableInteraction
} from "discord.js";
import {row, runSession, sessionId} from "./framework";


type PageComponent = NonNullable<InteractionEditReplyOptions["components"]>[number];

export interface PaginateOptions<T> {
    interaction: RepliableInteraction;
    items: T[];
    /** Top-level components for one page. Controls are appended automatically. */
    renderPage: (items: T[], page: number, pages: number) => readonly PageComponent[];
    perPage?: number;
    timeout?: number;
    audience?: "invoker" | "anyone";
}


export async function paginate<T>(options: PaginateOptions<T>): Promise<void> {
    const {interaction, items, renderPage, perPage = 10, timeout, audience} = options;
    const pages = Math.max(1, Math.ceil(items.length / perPage));

    const controls = (page: number, ended: boolean): MessageActionRowComponentData[] => [
        {type: ComponentType.Button, customId: sessionId("first"), label: "<< First", style: ButtonStyle.Secondary, disabled: ended || page === 1},
        {type: ComponentType.Button, customId: sessionId("previous"), label: "< Previous", style: ButtonStyle.Primary, disabled: ended || page === 1},
        {type: ComponentType.Button, customId: sessionId("info"), label: `Page ${page} of ${pages}`, style: ButtonStyle.Secondary, disabled: true},
        {type: ComponentType.Button, customId: sessionId("next"), label: "Next >", style: ButtonStyle.Primary, disabled: ended || page === pages},
        {type: ComponentType.Button, customId: sessionId("last"), label: "Last >>", style: ButtonStyle.Secondary, disabled: ended || page === pages}
    ];

    await runSession<number>({
        interaction,
        initial: 1,
        timeout,
        audience,

        render: (page, {ended}) => ({
            // Set on every render, including the final one.
            flags: MessageFlags.IsComponentsV2,
            components: [
                ...renderPage(items.slice((page - 1) * perPage, page * perPage), page, pages),
                row(...controls(page, ended))
            ]
        }),

        reduce(action, page) {
            switch (action) {
                case "first": return 1;
                case "previous": return Math.max(1, page - 1);
                case "next": return Math.min(pages, page + 1);
                case "last": return pages;
                default: return undefined;
            }
        }
    });
}

import type {BaseComponentData} from "discord.js";

declare namespace JSX {
    interface ElementChildrenAttribute {
        children: unknown;
    }

    // type Element = any;

    type Element =
        | BaseComponentData;
    // | ReturnType<typeof import("./widgets/Messages").Basic>;
    // | ReturnType<typeof import("./commands/Command").SlashCommand>;
}
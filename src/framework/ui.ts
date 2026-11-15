/**
 * Annotation helpers for plain component data.
 *
 * When an array mixes component shapes, TypeScript infers a union of object
 * literals, fails to match a branch of discord.js's `components` union, and
 * falls through to the snake_case API branch with an unreadable error. Pinning
 * the element type fixes it.
 *
 * These are annotations, not casts. Everything inside stays checked.
 */

import {
    ComponentType,
    type ActionRowData, type ComponentInContainerData, type ContainerComponentData,
    type MessageActionRowComponentData, type TopLevelComponentData
} from "discord.js";


/**
 * A Components V2 message payload, accepted by reply / editReply / followUp /
 * update / send alike.
 *
 * `flags` is deliberately `number` rather than the MessageFlags enum. An
 * unannotated `MessageFlags.IsComponentsV2` widens to the whole enum, which is
 * not assignable to the narrower per-method flag unions discord.js declares;
 * `number` is assignable to a numeric enum and so satisfies all of them.
 */
export interface ComponentMessage {
    flags: number;
    components: TopLevelComponentData[];
}


export const row = (...components: MessageActionRowComponentData[]): ActionRowData<MessageActionRowComponentData> => ({
    type: ComponentType.ActionRow,
    components
});

export const container = (components: ComponentInContainerData[], options: Omit<ContainerComponentData, "type" | "components"> = {}): ContainerComponentData => ({
    type: ComponentType.Container,
    components,
    ...options
});

export const text = (content: string): ComponentInContainerData => ({
    type: ComponentType.TextDisplay,
    content
});

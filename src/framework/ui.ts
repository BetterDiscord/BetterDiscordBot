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
    type MessageActionRowComponentData
} from "discord.js";


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

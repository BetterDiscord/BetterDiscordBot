import {
    ComponentType, TextInputStyle,
    type ComponentInContainerData, type ContainerComponentData, type LabelComponentData,
    type ModalComponentData, type TextDisplayComponentData
} from "discord.js";
import type {AtLeast, Tag} from "../types";


/** A tag rendered as a container, with an optional thumbnail alongside the text. */
export function tagContainer(tag: Tag): ContainerComponentData {
    const body: TextDisplayComponentData[] = [];
    if (tag.title) body.push({type: ComponentType.TextDisplay, content: `# ${tag.title}`});
    body.push({type: ComponentType.TextDisplay, content: tag.content});

    const components: ComponentInContainerData[] = tag.thumbnailUrl
        ? [{
            type: ComponentType.Section,
            components: body,
            accessory: {type: ComponentType.Thumbnail, media: {url: tag.thumbnailUrl}}
        }]
        : body;

    return {type: ComponentType.Container, components};
}


/**
 * discord.js still marks `label` required on TextInputComponentData, even though
 * the label now lives on the wrapping Label component. The djsx version omitted
 * it (via `Omit<TextInputComponentData, "label">` plus a cast in ModalLabel) and
 * that is what currently ships, so we keep the payload identical rather than
 * introduce an untested field.
 *
 * This is the one cast left in the tags code, down from eighteen, and it is
 * confined to this helper.
 */
function field(customId: string, label: string, style: TextInputStyle, required: boolean, maxLength: number, value: string): LabelComponentData {
    return {
        type: ComponentType.Label,
        label,
        component: {type: ComponentType.TextInput, customId, style, required, maxLength, value} as LabelComponentData["component"]
    };
}


export function updateTagModal(tag: AtLeast<Tag, "name">): ModalComponentData {
    const isUpdating = !!tag.content;
    return {
        customId: "tagmodal",
        title: `${isUpdating ? "Update" : "Create"} Tag: ${tag.name}`,
        components: [
            field("title", "Tag Title", TextInputStyle.Short, false, 100, tag.title || ""),
            field("content", "Tag Content", TextInputStyle.Paragraph, true, 2000, tag.content || ""),
            field("thumbnail", "Tag Thumbnail URL", TextInputStyle.Short, false, 2000, tag.thumbnailUrl || "")
        ]
    };
}

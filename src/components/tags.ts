import {TextInputStyle} from "discord.js";
import type {AtLeast, Tag} from "../types";
import {Container, Label, Modal, Section, TextDisplay, TextInput, Thumbnail} from "./ui";


export function TagView(tag: Tag) {
    const text = [
        tag.title && TextDisplay(`# ${tag.title}`),
        TextDisplay(tag.content),
    ];

    return Container(
        tag.thumbnailUrl
            ? Section(Thumbnail(tag.thumbnailUrl), text)
            : text
    );
}

export function UpdateTagModal({customId, ...tag}: AtLeast<Tag, "name"> & {customId: string;}) {
    const isUpdating = !!tag.content;
    return Modal({customId, title: `${isUpdating ? "Update" : "Create"} Tag: ${tag.name}`},
        Label("Tag Title", TextInput({
            customId: "title",
            style: TextInputStyle.Short,
            required: false,
            maxLength: 100,
            value: tag.title || "",
        })),
        Label("Tag Content", TextInput({
            customId: "content",
            style: TextInputStyle.Paragraph,
            required: true,
            maxLength: 2000,
            value: tag.content || "",
        })),
        Label("Tag Thumbnail URL", TextInput({
            customId: "thumbnail",
            style: TextInputStyle.Short,
            required: false,
            maxLength: 2000,
            value: tag.thumbnailUrl || "",
        })),
    );
}

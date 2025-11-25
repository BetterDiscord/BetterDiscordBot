/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {Container, TextDisplay, Section, Thumbnail, Modal, ModalLabel, TextInput, TextInputStyle} from "@djsx";
import {type ContainerComponentData, type ModalComponentData} from "discord.js";
import type {AtLeast, Tag} from "../types";

export function Tag(tag: Tag) {
    const text = <>
        {tag.title && <TextDisplay>{`# ${tag.title}`}</TextDisplay>}
        <TextDisplay>{tag.content}</TextDisplay>
    </>;

    const container = <Container>
        {tag.thumbnailUrl
            ? <Section accessory={<Thumbnail url={tag.thumbnailUrl} />}>
                {text}
            </Section>
            : text
        }
    </Container>;

    return container as ContainerComponentData;
}

export function UpdateTagModal(tag: AtLeast<Tag, "name">) {
    const isUpdating = !!tag.content;
    return (<Modal customId="tagmodal" title={`${isUpdating ? "Update" : "Create"} Tag: ${tag.name}`}>
        <ModalLabel label="Tag Title">
            <TextInput
                customId="title"
                style={TextInputStyle.Short}
                required={false}
                maxLength={100}
                value={tag.title || ""}
            />
        </ModalLabel>
        <ModalLabel label="Tag Content">
            <TextInput
                customId="content"
                style={TextInputStyle.Paragraph}
                required={true}
                maxLength={2000}
                value={tag.content || ""}
            />
        </ModalLabel>
        <ModalLabel label="Tag Thumbnail URL">
            <TextInput
                customId="thumbnail"
                style={TextInputStyle.Short}
                required={false}
                maxLength={2000}
                value={tag.thumbnailUrl || ""}
            />
        </ModalLabel>
    </Modal>) as ModalComponentData;
}
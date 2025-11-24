import {ComponentType, type MediaGalleryComponentData} from "discord.js";
import {childrenToArray} from "./utils";


export type MediaGalleryProps = Omit<MediaGalleryComponentData, "type" | "items"> & {children: MediaGalleryComponentData["items"];};

export function MediaGallery({children, ...props}: MediaGalleryProps): MediaGalleryComponentData {
    return {
        type: ComponentType.MediaGallery,
        items: childrenToArray(children),
        ...props
    };
}
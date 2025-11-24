import type {MediaGalleryItemData, UnfurledMediaItemData} from "discord.js";
import {MediaItem} from "./MediaItem";


export type MediaGalleryItemProps = Omit<MediaGalleryItemData, "media"> & {url: string;};

export function MediaGalleryItem({url, description, spoiler}: MediaGalleryItemProps): MediaGalleryItemData {
    return {
        media: <MediaItem url={url} /> as UnfurledMediaItemData,
        description,
        spoiler,
    };
}
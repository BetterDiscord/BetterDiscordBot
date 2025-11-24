import {ComponentType, type ThumbnailComponentData} from "discord.js";


export type ThumbnailProps = Omit<ThumbnailComponentData, "type" | "media"> & {url: string;};

export function Thumbnail({url, ...props}: ThumbnailProps): ThumbnailComponentData {
    return {
        type: ComponentType.Thumbnail,
        media: {url},
        ...props
    };
}
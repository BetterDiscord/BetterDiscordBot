import {ComponentType, type FileComponentData, type UnfurledMediaItemData} from "discord.js";
import {MediaItem} from "./MediaItem";


export type FileProps = Omit<FileComponentData, "type" | "file"> & {filename: string;};

export function File({filename, id, spoiler}: FileProps): FileComponentData {
    return {
        type: ComponentType.File,
        id,
        spoiler,
        file: (<MediaItem url={`attachment://${filename}`} />) as UnfurledMediaItemData,
    };
}
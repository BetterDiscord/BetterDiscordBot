import {ComponentType, type FileUploadModalData} from "discord.js";


export type FileUploadProps = Omit<FileUploadModalData, "type">;

export function FileUpload({...props}: FileUploadProps): FileUploadModalData {
    return {
        type: ComponentType.FileUpload,
        ...props
    };
}
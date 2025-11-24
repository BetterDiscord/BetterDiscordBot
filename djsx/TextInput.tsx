import {ComponentType, type TextInputComponentData} from "discord.js";


export {TextInputStyle} from "discord.js";
export type TextInputProps = Omit<TextInputComponentData, "type">;

export function TextInput(props: TextInputProps): TextInputComponentData {
    return {
        type: ComponentType.TextInput,
        ...props
    };
}
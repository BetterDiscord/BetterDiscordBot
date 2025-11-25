import {ComponentType, type TextInputComponentData} from "discord.js";


export {TextInputStyle} from "discord.js";
export type TextInputProps = Omit<TextInputComponentData, "type" | "label">;

export function TextInput(props: TextInputProps): Omit<TextInputComponentData, "label"> {
    return {
        type: ComponentType.TextInput,
        ...props
    };
}
import {ComponentType, type SeparatorComponentData} from "discord.js";


export type SeparatorProps = Omit<SeparatorComponentData, "type">;

export function Separator(props: SeparatorProps): SeparatorComponentData {
    return {
        type: ComponentType.Separator,
        ...props
    };
}
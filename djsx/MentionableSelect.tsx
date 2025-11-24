import {ComponentType, type MentionableSelectMenuComponentData} from "discord.js";


export type MentionableSelectProps = Omit<MentionableSelectMenuComponentData, "type">;

export function MentionableSelect(props: MentionableSelectProps): MentionableSelectMenuComponentData {
    return {
        type: ComponentType.MentionableSelect,
        ...props
    };
}
import {ComponentType, type ChannelSelectMenuComponentData} from "discord.js";


export type ChannelSelectProps = Omit<ChannelSelectMenuComponentData, "type">;

export function ChannelSelect(props: ChannelSelectProps): ChannelSelectMenuComponentData {
    return {
        type: ComponentType.ChannelSelect,
        ...props
    };
}
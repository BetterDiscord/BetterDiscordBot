import type {HexColorString} from "discord.js";

/** Authored as hex for embeds. */
export default class Colors {
    static Info: HexColorString = "#5a88ce";
    static Warn: HexColorString = "#fbbf24";
    static Success: HexColorString = "#3ac172";
    static Danger: HexColorString = "#c13a3a";
    static Error: HexColorString = "#c13a3a";
}

const toInt = (hex: HexColorString): number => parseInt(hex.slice(1), 16);

/** The same palette as integers, which Components V2 container accents want. */
export const Accents = {
    Info: toInt(Colors.Info),
    Warn: toInt(Colors.Warn),
    Success: toInt(Colors.Success),
    Danger: toInt(Colors.Danger),
    Error: toInt(Colors.Error)
} as const;

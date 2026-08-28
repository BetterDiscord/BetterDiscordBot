/**
 * Every Discord snowflake and community-specific constant the bot depends on.
 *
 * These were inline literals scattered across six files — the BetterDiscord
 * guild id appeared four times, the developer role ids five. Each entry may be
 * overridden by an environment variable so the bot can be pointed at a test
 * server without editing source.
 */

const id = (key: string, fallback: string): string => process.env[key] || fallback;

export const config = {
    guilds: {
        /** The main BetterDiscord server. */
        betterDiscord: id("BD_GUILD_ID", "86004744966914048")
    },

    roles: {
        /** Roles in the main server that mark someone as a verified developer. */
        pluginDeveloper: id("BD_ROLE_PLUGIN_DEV", "125166040689803264"),
        themeDeveloper: id("BD_ROLE_THEME_DEV", "165005972970930176"),

        /** The equivalents in the developer community server, kept in sync. */
        communityPluginDeveloper: id("COMMUNITY_ROLE_PLUGIN_DEV", "948627723830591568"),
        communityThemeDeveloper: id("COMMUNITY_ROLE_THEME_DEV", "948627648706392104")
    },

    channels: {
        /** Where compromised-account warnings are posted. */
        accountIssues: id("BD_CHANNEL_ACCOUNT_ISSUES", "1465301762821853204")
    },

    automod: {
        /** The AutoMod rule whose keyword list `/spam link` appends to. */
        spamLinkRule: id("BD_AUTOMOD_SPAM_LINK_RULE", "1256935881168781332")
    }
} as const;

export default config;

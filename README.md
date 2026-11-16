# BetterDiscordBot

The Discord bot for the BetterDiscord server. It runs on [Bun](https://bun.sh) with
[discord.js](https://discord.js.org).

## Running

```sh
bun install
bun run validate   # checks the required environment variables
bun run deploy     # registers the slash commands with Discord
bun run start
```

`bun run clear` removes the registered slash commands, and `bun run test` runs the tests.

## Environment variables

The bot reads these from the environment or from a `.env` file in the project root.

### Required

| Variable        | What it is                                                             |
| --------------- | ---------------------------------------------------------------------- |
| `BOT_TOKEN`     | The bot's token.                                                       |
| `BOT_CLIENT_ID` | The application's ID.                                                  |
| `BOT_OWNER_ID`  | The user ID of the bot's owner, who can use the owner-only commands.   |

### Optional

| Variable             | What it is                                                                       |
| -------------------- | -------------------------------------------------------------------------------- |
| `BOT_GUILD_ID`       | The server that gets the owner-only commands. They are not registered without it. |
| `BOT_PERMISSIONS`    | The permissions number for the invite link in `/about`. Defaults to `0`.         |
| `BOT_DESCRIPTION`    | A description shown in `/about`.                                                 |
| `SUPPORT_SERVER_URL` | Adds a "Support Server" link to `/about`.                                        |
| `GITHUB_URL`         | Adds a "GitHub" link to `/about`.                                                |
| `TOPGG_ID`           | Adds a "Top.gg" link to `/about`.                                                |

### Privileged intents

Discord has to approve a bot for these intents, and logging in with an intent that is not turned on for the
application fails. Each one is therefore off unless its variable is set to exactly `true`.

| Variable              | Intents it turns on                              | Features that need it                                                |
| --------------------- | ------------------------------------------------ | -------------------------------------------------------------------- |
| `BOT_MESSAGE_INTENTS` | Guild Messages, Message Content, Direct Messages | The spam, invite and scam image filters, and direct message forwarding |
| `BOT_MEMBERS_INTENTS` | Guild Members                                    | Join and leave messages, name cleaning, and developer role syncing   |

A feature whose intent is off does nothing and reports no error.

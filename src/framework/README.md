# framework

Command, component and event plumbing. Two mechanisms, chosen by **lifetime**.

## Which one do I want?

> Does this UI need to work after a bot restart, or more than 15 minutes after it
> was sent?

**Yes → a registered component.** State cannot live in a closure, so it goes in
the custom id (and the database). Handled by the global dispatcher.

**No → a session.** The UI belongs to one invocation by one user and dies with
the interaction token. State lives in a closure. Handled by its own collector.

Using the wrong one is the usual source of "this button stopped working after a
deploy" (a session that should have been a component) and of duplicated
ownership/timeout logic (a component that should have been a session).

## Commands

```ts
export const command = defineCommand({
    guildOnly: true,                       // dispatcher checks inCachedGuild() for you
    data: {type: ApplicationCommandType.ChatInput, name: "…", description: "…"},
    async execute(interaction) {           // ChatInputCommandInteraction<"cached">
        …
    }
});

export const components = [/* defineComponent(...) results */];
```

`guildOnly` is a claim the dispatcher enforces *before* calling you, which is
what earns the `<"cached">` narrowing. Omit it and `interaction.guild` is
`null`-checked, as it should be.

`ownerOnly: true` restricts to `BOT_OWNER_ID` and routes the command to the
private guild at deploy time.

## Components (durable)

```ts
const picker = defineComponent({
    id: "selfroles.open",                  // unique namespace, prefix of every id it mints
    kind: "button",                        // fixes the interaction type
    guildOnly: true,
    params: {mode: OneOf("user", "admin")},

    async run(interaction, {mode}) {       // ButtonInteraction<"cached">, mode: "user" | "admin"
        …
    }
});

// emitting — checked in both directions
{type: ComponentType.Button, customId: picker.customId({mode: "admin"}), …}
```

`OneOf` yields a literal union, so a `switch` over the param can be exhaustive.
A missing param, a wrong type, or a typo in a literal is a compile error.

Custom ids are capped at Discord's 100 characters; `customId()` throws if you
exceed it rather than letting the API reject the message. A stale id from before
a deploy fails to decode and the user is told to re-run the command.

## Sessions (ephemeral)

```ts
await runSession<number>({
    interaction,
    initial: 1,
    render: (page, {ended}) => ({…}),                    // pure: state in, message out
    reduce: (action, page) => action === "next" ? page + 1 : undefined,
});
```

Controls use `sessionId("next")`, which carries a `~` prefix. The dispatcher
ignores those, so sessions and registered components share one custom-id space
without colliding.

The ownership check, the timeout and disabling the controls when the collector
ends all happen inside `runSession` — do not reimplement them per command.
`audience: "anyone"` opts out of the ownership check.

`awaitModal(interaction, modal, ["title", "content"])` is the one-shot version:
it returns `{submission, values}`, or `null` on timeout.

## Events

```ts
export default defineEvent({name: Events.MessageCreate, async execute(message) {…}});
export default defineEvents(                 // a file may register several
    {name: Events.GuildMemberAdd,    async execute(member) {…}},
    {name: Events.GuildMemberRemove, async execute(member) {…}},
);
```

## Migrating a command

1. Replace the `SlashCommandBuilder` chain with a plain
   `RESTPostAPIChatInputApplicationCommandsJSONBody` object.
2. `export const command = defineCommand({…})` instead of `export default {…}`.
3. Move each `button` / `modal` / `select` / `role` handler to its own
   `defineComponent`, and export them as `components`.
4. Replace `customId.split("-")[n]` with typed `params`.

Unmigrated commands keep working — the dispatcher has a legacy path that routes
them the old way. Delete `LegacyEntry` and friends from `dispatch.ts` once the
last command is converted.

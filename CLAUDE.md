# BetterDiscordBot

Discord bot for the BetterDiscord community. Bun + TypeScript + discord.js 14,
Keyv over SQLite for storage. Private to BD — not publicly invitable.

## Commands

```
bun run start       # run the bot
bun run deploy      # register slash commands (skips if unchanged; --force overrides)
bun run clear       # deregister everything
bun run validate    # check required environment variables
bun test            # 96 tests
bun run typecheck   # tsc --noEmit
bun run lint        # eslint .
```

CI runs `bun test`, `bun run typecheck` and `bun run lint`. All three must pass.
Run them before committing — the type-aware lint rules apply to tests too, and
several genuine bugs have surfaced from `lint` rather than `tsc`.

Bun is **pinned to 1.4.0** in `.github/workflows/ci.yml`. `bun.lock` is version
sensitive; if you change dependencies, regenerate the lockfile with the same Bun
version CI uses, or `--frozen-lockfile` fails there and not locally.

## Layout

```
src/framework/   command / component / event plumbing (see its own README)
src/commands/    one file per slash command
src/components/  reusable message pieces
src/events/      one file per gateway listener (may export several)
src/util/        notices, modlog, colors, addons, names, stats, time, web
src/config.ts    every Discord snowflake, env-overridable
tests/           bun test; helpers/ has the interaction and session stubs
```

`src/index.ts` builds the dispatcher at startup, so a malformed command or a
duplicate component namespace fails at boot rather than on first use.

## Conventions

**Plain object literals, never builders.** discord.js's data interfaces
(`ContainerComponentData`, `ActionRowData`, `RESTPostAPIChatInputApplicationCommandsJSONBody`…)
are fully typed and infer correctly. `SlashCommandBuilder` and `ContainerBuilder`
are not used anywhere. There was a JSX layer (`djsx/`) here until recently; it
was removed because TypeScript has one global `JSX.Element` type, so every
expression needed an `as` cast and the type checker stopped helping at exactly
the boundary where mistakes are expensive. Don't reintroduce it.

**Components V2, not embeds.** Status messages go through
`src/util/notices.ts` (`success` / `info` / `warn` / `error` / `danger`),
moderation logs through `src/util/modlog.ts`. `/about` is the single deliberate
exception and says why in a comment: its stats are inline fields three to a row,
and V2 has no field grid.

**Two interaction mechanisms, chosen by lifetime.** Read
`src/framework/README.md` before touching interaction code. Short version:

- Must survive a restart or outlive the 15-minute token → `defineComponent`,
  with state encoded in a typed custom id.
- Belongs to one invocation by one user → `runSession` (or `awaitModal`).

Never hand-roll a collector. The ownership check, the timeout and the
disable-on-end pass live in `src/framework/session.ts` and nowhere else.

**Config, not literals.** Snowflakes belong in `src/config.ts`, which allows an
env override per entry. `src/util/web.ts` keeps its release-channel ids — that
is upstream BetterDiscord website data, not deployment config.

**Style.** 4 spaces, double quotes, `{noSpaces}` inside braces, semicolons.
Match the file you're in.

## Footguns

Every one of these caused a real, shipped bug in this repo.

**`RegExp.prototype.test` with a `/g` flag is stateful.** It advances
`lastIndex` and resumes there next call, so a shared module-level regex returns
alternating answers for the same input. Use `/g` only with `matchAll` or
`String.match`. See `src/util/names.ts`.

**A message cannot switch between embed mode and Components V2 mode after it is
created.** If a flow replies one way and updates the other, Discord rejects it.
Convert a whole flow at once or not at all.

**`interaction.update()` works once.** A second call throws
`InteractionAlreadyReplied`. Use `editReply()` for subsequent edits — a
long-running handler that updates then updates again will silently never show
its result.

**`editReply()` before any defer or reply throws.** Handlers that end in
`showModal()` can never defer, so their early exits must `reply()`.

**Select menus need between 1 and 25 options**, and `setMaxValues(0)` is
invalid. Always guard the empty case before rendering a menu.

**`MessageFlags.IsComponentsV2` widens to the whole `MessageFlags` enum** in an
unannotated object literal, which is not assignable to discord.js's narrower
per-method flag unions. Annotate with `ComponentMessage` from
`src/framework/ui.ts`, whose `flags` is `number` (assignable to a numeric enum).

**Mixed-type component arrays need their element type pinned.** TypeScript
infers a union of object literals, fails to match a branch of the `components`
union, falls through to the snake_case API branch, and produces a 30-line
unreadable error. Use `row()` / `container()` / `text()` from
`src/framework/ui.ts`. These are annotations, not casts.

**`TextInputComponentData` still requires `label`** even inside a `Label`
component, where the API ignores it. `src/components/tags.ts` absorbs this in
one helper; the payload deliberately omits it to match what ships.

**Custom ids are capped at 100 characters.** `customId()` throws rather than
letting the API reject the message. Store a payload and reference it by key if
you need more.

**`defineCommand` rejects extra properties**, so subcommand handlers must be
module-level functions, not methods called through `this`.

**`string-similarity`'s `findBestMatch` throws on an empty candidate array.**
Guard before ranking.

**Refresh caches by fetching into a local, then swapping.** Clearing and
stamping a timestamp before the request means one failure leaves an empty cache
that will not retry. See `ensureCache` in `src/util/addons.ts`.

## Testing

`bun test`. Two shared harnesses keep tests free of gateway or network setup:

- `tests/helpers/interactions.ts` — stubs the type guards and reply methods the
  dispatcher actually calls.
- `tests/helpers/session.ts` — stands in for the message component collector.
  `press(action, {userId, values})` delivers a click; omit `values` for a
  button, pass them for a select menu.

The session harness waits for `runSession` to attach its collector before
emitting. A press issued immediately after starting a session lands before the
listener exists — that is the shape of a flake here, and it has twice turned out
to be the harness at fault rather than the code. Suspect the harness first.

`tests/commands.test.ts` snapshots every deployed command payload against
`tests/fixtures/command-payloads.json`. Refactors should leave it untouched.
When a command change is intended:

```
bun run tests/fixtures/regenerate-payloads.ts
```

and review the resulting diff — that diff is the point of the fixture.

`tests/regressions.test.ts` has one test per bug fixed during the refactor, each
naming the failure it guards against. Add to it when you fix something silent.

## Deliberately left alone

- `/about` keeps its `EmbedBuilder` (see above).
- The invite whitelist in `src/events/invitefilter.ts` is still a hardcoded
  array with a `TODO`. Making it configurable is a feature decision.
- `src/commands/debug.tsx` is gitignored. If a local copy exists it predates the
  djsx removal and will not load.

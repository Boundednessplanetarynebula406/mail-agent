# mail-agent

`mail-agent` is a Fastmail-first Codex plugin and local daemon for agent-friendly email, calendar, and contacts workflows.

It is built for the cases where "use my mailbox like an API" works better than "drive a human mail client through text scraping."

## What it is

The repo ships three coordinated pieces:

- `mail-agent`: the public CLI and Codex plugin bundle
- `@mail-agent/daemon`: the local MCP daemon that exposes structured tools
- `@mail-agent/shared`: shared runtime, config, policy, and secret-store logic

In practice, the top-level package is what most people care about. The other two packages exist so the workspace can be developed, tested, and released cleanly.

## What it does today

v1 is Fastmail-focused and supports:

- Mail via `JMAP`
  - `list_mailboxes`
  - `search_messages`
  - `read_message_batch`
  - `read_thread`
  - `compose_message`
  - `draft_reply`
  - `send_message`
  - `archive_messages`
  - `move_messages`
  - `tag_messages`
  - `mark_messages`
  - `delete_messages` with explicit confirmation
- Calendar via `CalDAV`
  - `list_calendars`
  - `get_events`
- Contacts via `CardDAV`
  - `search_contacts`
  - `get_contact`

The tool names are provider-generic on purpose, but Fastmail is the only supported provider in v1.

## Why it exists

Most mailbox integrations for agents land in one of two camps:

- vendor-specific APIs with weak workflow guidance
- general-purpose mail clients that were designed for humans, not models

`mail-agent` takes a different route:

- structured tool contracts instead of terminal scraping
- skills that teach Codex how to search, shortlist, summarize, draft, and mutate safely
- local-first setup so credentials stay on your machine
- an explicit safety model for sends and destructive actions

## How it works

At runtime the flow is:

1. Codex loads the local `Mail Agent` plugin bundle.
2. The plugin starts a local stdio MCP server named `mail-agent`.
3. The daemon reads local account config plus secrets from the OS keychain or a file-backed development store.
4. The daemon talks to Fastmail over:
   - `JMAP` for mail
   - `CalDAV` for calendars
   - `CardDAV` for contacts
5. Skills tell the agent how to use the tools well, not just that the tools exist.

That last point matters. The tool layer makes actions possible. The skill layer makes the agent behave sensibly.

## What Codex gets

After install, Codex sees:

- a plugin called `Mail Agent`
- a local MCP server called `mail-agent`
- workflow skills:
  - `mail-agent`
  - `mail-agent-inbox-triage`
  - `calendar-brief`
  - `contacts-lookup`

Example prompts:

- "Use `mail-agent` to summarize the latest recruiter thread and draft the reply."
- "Use `mail-agent-inbox-triage` to sort unread inbox mail into urgent, reply soon, waiting, and FYI."
- "Use `calendar-brief` to summarize my next two days and flag conflicts."
- "Use `contacts-lookup` to find Jane from Acme and confirm her best email."

## Requirements

- Node `22+`
- `pnpm` via Corepack
- Codex with plugins enabled
- A Fastmail account
- Two Fastmail credentials:
  - `JMAP API token` for mail
  - `app password` for CalDAV/CardDAV

Notes:

- v1 does not use OAuth.
- v1 does not support calendar or contact writes.
- `delete_messages` is always gated, even in trusted mode.

## Install from source

Clone and build the workspace:

```powershell
git clone https://github.com/bestlux/mail-agent.git
cd mail-agent
corepack pnpm install
corepack pnpm build
```

Install the local plugin bundle into Codex:

```powershell
node packages/plugin/dist/bin/mail-agent.js install
```

Authenticate a Fastmail account:

```powershell
node packages/plugin/dist/bin/mail-agent.js auth fastmail --account personal --email you@fastmail.com
```

Run a health check:

```powershell
node packages/plugin/dist/bin/mail-agent.js doctor
```

## Install from npm

The release layout is designed so the public package is `mail-agent`, with `@mail-agent/daemon` and `@mail-agent/shared` published alongside it as internal support packages.

After the packages are published, the intended CLI install is:

```powershell
npm install -g mail-agent
mail-agent install
mail-agent auth fastmail --account personal --email you@fastmail.com
mail-agent doctor
```

## Fastmail setup

You need two credentials:

1. `JMAP API token`
2. `app password` for CalDAV/CardDAV

The interactive auth flow prompts for both. You can also pass them non-interactively:

```powershell
node packages/plugin/dist/bin/mail-agent.js auth fastmail `
  --account personal `
  --email you@fastmail.com `
  --jmap-token <token> `
  --app-password <app-password>
```

## Runtime and secret storage

Runtime state lives under your OS config directory:

- Windows: `%APPDATA%\mail-agent`
- macOS: `~/Library/Application Support/mail-agent`
- Linux: `$XDG_CONFIG_HOME/mail-agent` or `~/.config/mail-agent`

Secrets default to the OS keychain via `keytar`.

For testing or CI you can force file-backed secrets:

```powershell
$env:MAIL_AGENT_SECRET_BACKEND='file'
```

That stores credentials in the runtime directory instead of the OS keychain. Fine for local development and CI. Not ideal for day-to-day use.

If your package manager blocks native postinstall scripts, `keytar` may need explicit build approval before the keychain backend works.

## Safety model

`mail-agent` is meant to be useful without being reckless.

- `send_message` is available only after account auth and policy allow it
- archive, move, tag, and mark are allowed in trusted mode
- `delete_messages` is always a two-step flow
- calendar and contacts are read-only in v1

Delete is intentionally explicit:

1. first call requests a confirmation token
2. second call repeats the delete with that token

That keeps permanent deletion out of the "oops, the agent inferred too much" category.

## Search behavior that matters in real use

The search tool is where most real workflows start, so the useful details are worth calling out:

- `collapseThreads: true` keeps broad scans readable
- `mailboxRole` is better than hardcoded mailbox names when possible
- `excludeMailingLists: true` helps for person-to-person scans
- `since` and `until` accept RFC3339 timestamps or `YYYY-MM-DD`
- `refresh: true` bypasses short-lived cache entries when polling after send or mutation

Those behaviors exist because they materially improve agent use, not because they are cute transport options.

## Repository layout

```text
packages/
  plugin/   Codex plugin bundle, CLI, installer, skills
  daemon/   local MCP daemon and Fastmail adapters
  shared/   runtime paths, config, cache, policy, secret handling

.github/    CI and contributor-facing GitHub configuration
```

## Development

Install dependencies:

```powershell
corepack pnpm install
```

Build everything:

```powershell
corepack pnpm build
```

Run tests:

```powershell
corepack pnpm test
```

Check package contents before publishing:

```powershell
corepack pnpm pack:check
```

Dry-run the workspace publish flow:

```powershell
corepack pnpm release:dry-run
```

Run the daemon directly:

```powershell
node packages/plugin/dist/bin/mail-agent.js daemon
```

## Support policy

Supported in v1:

- Fastmail mail via `JMAP`
- Fastmail calendars via `CalDAV` read operations
- Fastmail contacts via `CardDAV` read operations

Not supported in v1:

- OAuth
- calendar writes
- contact writes
- full local mailbox mirroring
- non-Fastmail providers as first-class supported targets

## Known caveats

- Fastmail mail auth and DAV auth are separate by design
- contact search is a pragmatic address-book scan, not a server-side indexed search engine
- event parsing is intentionally lightweight and does not aim to be a full iCalendar implementation yet

## Docs

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [SECURITY.md](./SECURITY.md)
- [PRIVACY.md](./PRIVACY.md)
- [TERMS.md](./TERMS.md)
- [SUPPORT.md](./SUPPORT.md)
- [RELEASING.md](./RELEASING.md)

## Roadmap

Near-term improvements:

- stronger recurrence and event parsing
- richer contact matching
- provider adapters beyond Fastmail
- optional local indexing for heavier research workflows
- more polished release automation

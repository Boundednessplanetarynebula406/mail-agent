# Contributing

Thanks for taking a look at `mail-agent`.

This repo is small on purpose. The goal is a practical Codex plugin and daemon that behaves well in real mailbox workflows, not an abstract protocol playground.

## Before you start

- Read [README.md](./README.md) for the product shape.
- Read [SECURITY.md](./SECURITY.md) before filing anything that might involve credentials or mailbox access.
- If you are proposing provider support beyond Fastmail, open an issue first so the adapter boundaries stay coherent.

## Local setup

```powershell
corepack pnpm install
corepack pnpm build
corepack pnpm test
```

For local development without OS keychain integration:

```powershell
$env:MAIL_AGENT_SECRET_BACKEND='file'
```

## What good contributions look like

- scoped changes with a clear reason
- tests for behavior changes
- docs updates when the public surface changes
- no unrelated formatting churn

## Code and workflow expectations

- Prefer small, reviewable diffs.
- Keep provider-specific logic behind provider adapters.
- Preserve the public tool contracts unless the change is intentional and documented.
- If you change a skill or tool, update the matching docs.

## Validation

Before opening a PR, run:

```powershell
corepack pnpm build
corepack pnpm test
corepack pnpm pack:check
```

If your change touches release behavior, also run:

```powershell
corepack pnpm release:dry-run
```

## Issues

Bug reports are most useful when they include:

- OS
- Node version
- whether `keytar` or file-backed secrets were used
- whether the bug is in mail, calendar, contacts, plugin install, or packaging
- exact command or workflow that failed

## Pull requests

- explain the user-facing problem first
- explain the chosen fix second
- call out validation that actually ran
- mention any residual gaps

## Secrets and test data

Do not commit:

- tokens
- app passwords
- raw mailbox dumps
- personal contact exports

Use redacted fixtures and synthetic test data wherever possible.

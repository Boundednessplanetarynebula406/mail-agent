# Security Policy

## Scope

`mail-agent` handles credentials and local access to email, calendar, and contacts. Treat anything involving secret leakage, unauthorized mailbox access, unsafe local secret storage, or unintended destructive actions as a security issue.

## Supported versions

Until versioned release branches exist, only the latest `main` release line is considered supported for security fixes.

## Reporting a vulnerability

If the GitHub repository has private vulnerability reporting enabled, use that.

If private reporting is not available yet:

- do not open a public issue with live tokens, passwords, or exploit details
- open a minimal public issue asking for a private contact path, or wait until a private reporting channel is available

When reporting, include:

- affected version or commit
- operating system
- whether the issue involves `JMAP`, `CalDAV`, `CardDAV`, plugin install, or local secret storage
- minimal reproduction steps
- impact assessment

## Handling expectations

- I will aim to acknowledge reports quickly
- I may ask for a reduced reproduction without secrets
- fixes may land privately first if the issue is severe enough

## What not to include

Do not include:

- live Fastmail tokens
- app passwords
- unredacted mailbox contents
- full secret-store files

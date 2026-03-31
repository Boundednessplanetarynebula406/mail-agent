# Privacy Policy

## Summary

`mail-agent` is designed to run locally and keep mailbox access under the user's control.

## What the software accesses

When configured, the software may access:

- email metadata and message bodies
- calendar names and events
- contact records

The exact access depends on the configured account and which tools are called.

## Where data goes

By default:

- account config is stored locally on the machine
- secrets are stored in the OS keychain when available
- a file-backed secret store can be enabled for development or CI

`mail-agent` does not ship with a hosted backend service.

## What the maintainer receives

The software does not intentionally send mailbox or contact data to a maintainer-controlled service.

If you file issues, you are responsible for redacting:

- tokens
- passwords
- mailbox contents
- contact exports

## Third-party services

The current v1 implementation talks directly to Fastmail using:

- `JMAP`
- `CalDAV`
- `CardDAV`

Your use of Fastmail remains subject to Fastmail's own terms and privacy policies.

## Local development note

If you set `MAIL_AGENT_SECRET_BACKEND=file`, secrets are stored on disk in the runtime directory instead of the OS keychain. That is convenient for testing but less protective than the default path.

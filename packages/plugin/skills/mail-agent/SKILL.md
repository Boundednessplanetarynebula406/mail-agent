---
name: mail-agent
description: Work with email, calendars, and contacts through the local Mail Agent daemon. Use when the user wants inbox triage, thread summaries, reply drafts, outbound sends, mailbox cleanup, calendar review, or contact lookup with explicit delete confirmation.
---

# Mail Agent

Use this skill to operate against configured `mail-agent` accounts through the local daemon.

The general rule is simple:

- search first
- read enough context to be right
- draft before send unless the user is explicit
- mutate carefully
- make delete unmistakably intentional

## Core operating model

- Use `list_accounts` if the target account is unclear.
- Use `list_mailboxes` when a mailbox destination or scope is ambiguous.
- Use `search_messages` to build a shortlist before reading whole threads.
- Prefer `collapseThreads: true` for broad scans so one long thread does not drown the result set.
- Use `excludeMailingLists: true` when the user wants human conversations rather than newsletters, alerts, or bulk mail.
- Use `read_thread` when reply tone, chronology, or commitments depend on thread history.
- Use `read_message_batch` when snippets are insufficient but full-thread context is unnecessary.
- Use `compose_message` or `draft_reply` before `send_message` unless the user explicitly asked to send right away.
- Use `refresh: true` when polling for a newly delivered message or checking the result of a recent mutation.

## Mail defaults

- Start narrow when possible: sender, recipient, subject terms, unread state, mailbox role, and date range.
- When the user asks for a summary, state the search scope so the answer is auditable.
- When the result set is large, summarize the shortlist first and expand only if needed.
- Preserve recipients, dates, and commitments when drafting unless the user asks to change them.
- Match the existing thread tone by default.
- If recipient scope is ambiguous, draft the safest body and call out the assumption.

## Mail mutations

- `archive_messages`, `move_messages`, `tag_messages`, and `mark_messages` are normal trusted automation tools in v1.
- `send_message` is allowed, but use it only when the user clearly wants the message sent.
- `delete_messages` is always destructive and always gated:
  1. call without `confirmationToken`
  2. inspect the returned token
  3. only repeat the call if permanent deletion is clearly intended

Never describe delete as reversible unless you know the provider behavior supports that claim.

## Calendar defaults

- Use `list_calendars` if the calendar target is not obvious.
- Use `get_events` with bounded time windows rather than broad unbounded pulls.
- Lead calendar summaries with the next events, then conflicts, then prep or travel concerns.
- If the result is empty, say that explicitly instead of implying a fetch failure.

## Contacts defaults

- Use `search_contacts` for fragments of names, organizations, or email addresses.
- Use `get_contact` for an exact contact the user already named or for a shortlist winner.
- Call out fuzzy matches when multiple similar contacts exist.
- Include the most useful reachability fields first: email, phone, organization.

## Time and search handling

- `since` and `until` accept RFC3339 timestamps or `YYYY-MM-DD`.
- Prefer recent bounded windows for triage and process tracking.
- If you are inferring status from correspondence, say that it is an estimate based on the latest mail rather than a system-of-record fact.

## Workflow references

- Search and shortlist guidance: [references/search-workflow.md](./references/search-workflow.md)
- Reply drafting guidance: [references/reply-workflow.md](./references/reply-workflow.md)
- Forward and handoff guidance: [references/forward-workflow.md](./references/forward-workflow.md)
- Mutation safety guidance: [references/safety-workflow.md](./references/safety-workflow.md)

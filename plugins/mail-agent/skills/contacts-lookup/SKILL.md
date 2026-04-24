---
name: contacts-lookup
description: Look up contacts through Mail Agent and summarize who they are, how to reach them, and where they appear.
---

# Contacts Lookup

- Use `search_contacts` for name, company, or email fragments.
- Use `get_contact` when the user names a specific contact or a shortlist item.
- Summaries should include primary emails, phones, organizations, and any confidence note if the match is fuzzy.
- If multiple plausible matches exist, present the shortlist before assuming one.
- Do not imply contact creation or edits in v1.

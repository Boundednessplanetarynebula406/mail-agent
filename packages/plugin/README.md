# mail-agent plugin bundle

This package contains the public Codex-facing layer for `mail-agent`:

- the `.codex-plugin/plugin.json` manifest
- the local MCP server wiring in `.mcp.json`
- the plugin skills and workflow references
- the install, auth, doctor, and daemon CLI entrypoints

`mail-agent install` copies the bundled plugin into `~/.codex/plugins/mail-agent` and registers it through `~/.agents/plugins/marketplace.json`. The installed bundle includes the plugin manifest, MCP server config, CLI entrypoints, and skills needed for Codex to discover the `Mail Agent` plugin.

Most users want the repo root docs first:

- [README.md](../../README.md)
- [CONTRIBUTING.md](../../CONTRIBUTING.md)

If you install the published package, `mail-agent` is the CLI you run.

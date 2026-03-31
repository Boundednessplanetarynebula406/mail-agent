# Releasing

This workspace publishes three packages together:

- `mail-agent`
- `@mail-agent/daemon`
- `@mail-agent/shared`

The public package is `mail-agent`. The scoped packages are internal support packages that the public CLI depends on.

## Pre-release checks

Run:

```powershell
corepack pnpm install
corepack pnpm build
corepack pnpm test
corepack pnpm pack:check
corepack pnpm release:dry-run
```

## Release flow

1. Bump versions consistently across the three package manifests.
2. Build and test the workspace.
3. Dry-run the publish flow.
4. Publish the workspace packages.
5. Tag the release and update release notes.

## Notes

- `pnpm publish` rewrites workspace dependency ranges during publish.
- Do not publish only the `mail-agent` package without publishing the support packages for the same version.
- Verify the npm package contents before release so local-only files are not accidentally shipped.

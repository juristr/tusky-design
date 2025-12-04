# Releasing to npm

## Overview

Two-step release process:
1. **Local**: Developer runs `pnpm release <version>` → creates GitHub Release
2. **CI**: GitHub Actions detects `release: published` event → publishes to npm via OIDC

## Usage

```bash
# Release a new version
pnpm release 1.2.0

# With custom changelog base commit
pnpm release 1.2.0 --from=1.1.0
```

## Prereleases

Prerelease versions are tagged as `next` on npm (not `latest`), so users must opt-in.

```bash
# Beta release
pnpm release 1.2.0-beta.0
pnpm release 1.2.0-beta.1

# Release candidate
pnpm release 1.2.0-rc.0
pnpm release 1.2.0-rc.1

# Alpha (early testing)
pnpm release 1.2.0-alpha.0
```

Users install prereleases with:
```bash
npm install @juristr/tusky-design@next
# or specific version
npm install @juristr/tusky-design@1.2.0-beta.1
```

When ready for stable release:
```bash
pnpm release 1.2.0
```

The script:
1. Builds all packages
2. Copies to `build/packages/`
3. Bumps version in built package.json
4. Opens interactive changelog editor
5. Creates GitHub Release (which triggers CI publish)

## CI Workflow

`.github/workflows/publish.yml` triggers on:
- `release: published` - production releases
- `workflow_dispatch` - dry-run testing

CI uses npm OIDC trusted publishing (`id-token: write`) - no `NPM_TOKEN` needed.

## Dist Tags

- `latest` - stable releases
- `next` - prereleases (beta, rc, alpha)
- `previous` - older major versions

## Configuration

- `nx.json` - release config (version resolver, changelog settings)
- `scripts/release.ts` - release orchestration
- Version source: npm registry (`currentVersionResolver: "registry"`)
- Git commit/tag disabled (GitHub Release creates the tag)

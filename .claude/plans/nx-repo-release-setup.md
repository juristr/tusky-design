# Nx Publishing Workflow - Implementation Guide

This guide explains how to implement the Nx-style publishing workflow in your own repository.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
            │
│  pnpm nx-release --local=false 20.0.0                              │
│    ├── nx release version --specifier 20.0.0                       │
│    │     └── Updates dist/packages/*/package.json                  │
│    └── nx release changelog 20.0.0 --interactive workspace         │
│          └── Creates GitHub Release (tag: 20.0.0)                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ triggers
┌─────────────────────────────────────────────────────────────────────┐
│                         CI (GitHub Actions)                         │
│  publish.yml (on: release: published)                              │
│    ├── build job (matrix): native bindings for all platforms       │
│    └── publish job:                                                │
│          ├── Download artifacts                                    │
│          └── nx release publish --registry=... --tag=...           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Step 1: Configure `nx.json` Release Settings

```json
{
  "release": {
    // Which projects to include in releases
    "projects": ["packages/*"],

    // Tag pattern - {version} means tags like "20.0.0" not "v20.0.0"
    "releaseTagPattern": "{version}",

    "changelog": {
      "workspaceChangelog": {
        // Creates GitHub Release with changelog as body
        "createRelease": "github",
        // Don't create CHANGELOG.md file
        "file": false
      },
      "git": {
        // Don't commit/tag - GitHub Release handles this
        "commit": false,
        "stageChanges": false,
        "tag": false
      }
    },

    "version": {
      "git": {
        // Don't commit/tag during version step
        "commit": false,
        "stageChanges": false,
        "tag": false
      },
      // Get current version from npm registry, not package.json
      "currentVersionResolver": "registry",
      // Update package.json in dist folder, not source
      "manifestRootsToUpdate": ["dist/packages/{projectName}"],
      "versionActionsOptions": {
        // Don't update lockfile
        "skipLockFileUpdate": true
      }
    }
  },

  "targetDefaults": {
    "nx-release-publish": {
      "options": {
        // Publish from dist folder
        "packageRoot": "dist/packages/{projectName}"
      }
    }
  }
}
```

**Key design decisions:**

- Version is resolved from npm registry → no local state drift
- Updates happen in `dist/` → source `package.json` stays clean
- No git operations → GitHub Release API creates the tag

---

## Step 2: Create Release Script (`scripts/nx-release.ts`)

### Basic Structure

```typescript
#!/usr/bin/env node
import { execSync } from 'node:child_process';
import * as yargs from 'yargs';

const LARGE_BUFFER = 1024 * 1000000;

(async () => {
  const options = parseArgs();

  // CASE 1: Local development release (to local registry)
  if (options.local) {
    await publishLocal(options);
    return;
  }

  // CASE 2: Creating GitHub Release (run by developer)
  if (!process.env.NODE_AUTH_TOKEN) {
    await createGitHubRelease(options);
    return;
  }

  // CASE 3: Publishing to npm (run by CI)
  await publishToNpm(options);
})();
```

### Creating GitHub Release (Developer's Machine)

```typescript
async function createGitHubRelease(options: Options) {
  // Require exact version for real releases
  if (isRelativeVersionKeyword(options.version)) {
    throw new Error('Must use exact semver version for real releases');
  }

  // 1. Bump versions in dist/
  execSync(`pnpm nx release version --specifier ${options.version}`, {
    stdio: [0, 1, 2],
    maxBuffer: LARGE_BUFFER,
  });

  // 2. Create changelog + GitHub Release (interactive)
  let cmd = `pnpm nx release changelog ${options.version} --interactive workspace`;
  if (options.from) cmd += ` --from ${options.from}`;
  if (options.gitRemote) cmd += ` --git-remote ${options.gitRemote}`;

  execSync(cmd, { stdio: [0, 1, 2], maxBuffer: LARGE_BUFFER });

  console.log('Check GitHub Actions for publish status');
  process.exit(0);
}
```

### Publishing to npm (CI)

```typescript
async function publishToNpm(options: Options) {
  // 1. Bump versions
  execSync(`pnpm nx release version --specifier ${options.version}`, {
    stdio: 'ignore',
    maxBuffer: LARGE_BUFFER,
  });

  // 2. Determine dist tag
  const distTag = determineDistTag(options.version);

  // 3. Publish
  execSync(`pnpm nx release publish --registry=https://registry.npmjs.org --tag=${distTag}`, { stdio: [0, 1, 2], maxBuffer: LARGE_BUFFER });
}
```

### Dist Tag Logic

```typescript
function determineDistTag(version: string): string {
  // Canary releases
  if (version.includes('canary')) return 'canary';

  // PR releases
  if (version.startsWith('0.0.0-pr-')) return 'pull-request';

  // Prerelease (beta, rc, etc.)
  const parsed = semver.parse(version);
  if (parsed.prerelease.length > 0) return 'next';

  // Check if this is an older major version
  const latestVersion = execSync('npm view YOUR_PACKAGE version').toString().trim();
  const latestMajor = semver.major(latestVersion);

  if (parsed.major < latestMajor) return 'previous';

  return 'latest';
}
```

### CLI Arguments

```typescript
function parseArgs() {
  return yargs
    .option('local', {
      type: 'boolean',
      default: true,
      description: 'Publish to local registry',
    })
    .option('dryRun', {
      type: 'boolean',
      description: 'Run without making changes',
    })
    .option('from', {
      type: 'string',
      description: 'Git ref for changelog generation',
    })
    .option('gitRemote', {
      type: 'string',
      default: 'origin',
      description: 'Git remote for tags',
    })
    .positional('version', {
      type: 'string',
      default: 'minor',
    })
    .parseSync();
}
```

---

## Step 3: GitHub Actions Workflow (`.github/workflows/publish.yml`)

### Triggers

```yaml
name: publish

on:
  # Canary releases (scheduled)
  schedule:
    - cron: '0 19 * * 1-5' # Mon-Fri 7pm UTC

  # PR releases or dry-runs (manual)
  workflow_dispatch:
    inputs:
      pr:
        description: 'PR Number for release'
        required: false
        type: number

  # Production releases (from local nx-release)
  release:
    types: [published]

env:
  NODE_VERSION: 22.16.0
  PNPM_VERSION: 10.11.1
```

### Job 1: Resolve Data

```yaml
jobs:
  resolve-required-data:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.script.outputs.version }}
      dry_run_flag: ${{ steps.script.outputs.dry_run_flag }}
      ref: ${{ steps.script.outputs.ref }}
      repo: ${{ steps.script.outputs.repo }}
    steps:
      - uses: actions/checkout@v5

      - uses: actions/setup-node@v5
        with:
          node-version: ${{ env.NODE_VERSION }}
          registry-url: 'https://registry.npmjs.org'

      - name: Resolve version and checkout data
        id: script
        uses: actions/github-script@v8
        with:
          script: |
            // For release event: version from tag
            if (context.eventName === 'release') {
              core.setOutput('version', context.payload.release.tag_name);
              core.setOutput('dry_run_flag', '');
              return;
            }

            // For schedule: canary version
            if (context.eventName === 'schedule') {
              core.setOutput('version', 'canary');
              core.setOutput('dry_run_flag', '');
              return;
            }

            // For workflow_dispatch without PR: dry run
            if (!process.env.PR_NUMBER) {
              core.setOutput('version', 'minor');
              core.setOutput('dry_run_flag', '--dry-run');
              return;
            }

            // For PR release: generate PR version
            const prNum = process.env.PR_NUMBER;
            core.setOutput('version', `0.0.0-pr-${prNum}`);
            // ... set ref/repo for PR checkout
```

### Job 2: Build (if you have native packages)

```yaml
build:
  needs: [resolve-required-data]
  strategy:
    matrix:
      settings:
        - host: macos-latest
          target: x86_64-apple-darwin
        - host: ubuntu-latest
          target: x86_64-unknown-linux-gnu
        # ... more platforms
  runs-on: ${{ matrix.settings.host }}
  steps:
    - uses: actions/checkout@v5
      with:
        ref: ${{ needs.resolve-required-data.outputs.ref || github.ref }}

    # Build steps...

    - uses: actions/upload-artifact@v4
      with:
        name: bindings-${{ matrix.settings.target }}
        path: packages/*/native/*.node
```

### Job 3: Publish

```yaml
publish:
  needs: [resolve-required-data, build]
  runs-on: ubuntu-latest
  environment: npm-registry # For protected secrets
  permissions:
    id-token: write # npm provenance
    contents: write # Create releases
    pull-requests: write # Comment on PRs
  steps:
    - uses: actions/checkout@v5
      with:
        ref: ${{ needs.resolve-required-data.outputs.ref || github.ref }}

    - uses: pnpm/action-setup@v4
      with:
        version: ${{ env.PNPM_VERSION }}

    - uses: actions/setup-node@v5
      with:
        node-version: ${{ env.NODE_VERSION }}
        registry-url: 'https://registry.npmjs.org'
        cache: 'pnpm'

    - run: pnpm install --frozen-lockfile

    # Download native artifacts (if applicable)
    - uses: actions/download-artifact@v5
      with:
        path: artifacts

    # Run the release script
    - name: Publish
      env:
        VERSION: ${{ needs.resolve-required-data.outputs.version }}
        DRY_RUN: ${{ needs.resolve-required-data.outputs.dry_run_flag }}
        NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
      run: |
        pnpm nx-release --local=false $VERSION $DRY_RUN
```

---

## Step 4: Package Scripts

Add to root `package.json`:

```json
{
  "scripts": {
    "nx-release": "ts-node ./scripts/nx-release.ts"
  }
}
```

---

## Step 5: Required Secrets

Configure in GitHub repository settings:

| Secret      | Purpose                                          |
| ----------- | ------------------------------------------------ |
| `NPM_TOKEN` | npm authentication                               |
| `GH_TOKEN`  | Creating GitHub releases (or use `github.token`) |

---

## Usage Examples

### Local Development

```bash
# Publish to local registry (default)
pnpm nx-release

# Specific version locally
pnpm nx-release 20.0.0-local.1
```

### Production Release

```bash
# Set GitHub token
export GH_TOKEN=ghp_xxx

# Create release (opens interactive changelog editor)
pnpm nx-release --local=false 20.0.0

# With custom base ref for changelog
pnpm nx-release --local=false 20.0.0 --from=19.8.0
```

### Canary Release (CI Only)

Triggered automatically Mon-Fri 7pm UTC, or manually via workflow dispatch.

### PR Release (CI Only)

Trigger via workflow dispatch with PR number input.

---

## Canary Version Generation

```typescript
function generateCanaryVersion(): string {
  const latestVersion = execSync('npm view YOUR_PACKAGE@latest version').toString().trim();
  const nextVersion = execSync('npm view YOUR_PACKAGE@next version').toString().trim();

  let baseVersion: string;

  // If next is a different major, use that major
  if (semver.major(latestVersion) !== semver.major(nextVersion)) {
    baseVersion = `${semver.major(nextVersion)}.0.0`;
  } else {
    // Next minor after latest
    baseVersion = semver.inc(latestVersion, 'minor');
  }

  // YYYYMMDD format
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

  // Short git SHA
  const sha = execSync('git rev-parse --short HEAD').toString().trim();

  return `${baseVersion}-canary.${dateStr}-${sha}`;
  // e.g., "20.1.0-canary.20241203-abc1234"
}
```

---

## Security Considerations

### Restrict `latest` Tag Publishing

```typescript
const VALID_AUTHORS_FOR_LATEST = ['maintainer1', 'maintainer2'];

if (distTag === 'latest') {
  const author = process.env.GITHUB_ACTOR ?? '';
  if (!VALID_AUTHORS_FOR_LATEST.includes(author)) {
    throw new Error(`User "${author}" cannot publish to latest`);
  }
}
```

### Validate Release Scripts in PR Releases

```yaml
- name: Ensure release scripts unchanged
  if: ${{ needs.resolve-required-data.outputs.ref != '' }}
  run: |
    FILES=("scripts/nx-release.ts" "scripts/publish-resolve-data.js")
    for FILE in "${FILES[@]}"; do
      if ! cmp -s "master/$FILE" "pr-branch/$FILE"; then
        echo "Error: $FILE was modified in PR"
        exit 1
      fi
    done
```

---

## Flow Summary

| Scenario        | Trigger              | Version                          | Dist Tag       |
| --------------- | -------------------- | -------------------------------- | -------------- |
| Local dev       | Manual               | `minor` (default)                | N/A            |
| Stable release  | `release: published` | From tag (e.g., `20.0.0`)        | `latest`       |
| Prerelease      | `release: published` | From tag (e.g., `20.0.0-beta.1`) | `next`         |
| Old major patch | `release: published` | From tag (e.g., `19.8.5`)        | `previous`     |
| Canary          | Scheduled cron       | Generated                        | `canary`       |
| PR release      | `workflow_dispatch`  | `0.0.0-pr-{num}`                 | `pull-request` |
| Dry run         | `workflow_dispatch`  | `minor`                          | N/A            |

---

## Checklist for Implementation

- [ ] Configure `nx.json` release settings
- [ ] Create `scripts/nx-release.ts`
- [ ] Create `.github/workflows/publish.yml`
- [ ] Add `NPM_TOKEN` secret to GitHub
- [ ] Configure GitHub environment `npm-registry` with required reviewers (optional)
- [ ] Test local publishing flow
- [ ] Test dry-run via workflow dispatch
- [ ] Test PR release flow
- [ ] Perform first production release

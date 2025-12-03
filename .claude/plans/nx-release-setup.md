# Plan: Setup Nx Release for @juristr/tusky-design

## Summary

Setup Nx Release to publish `@juristr/tusky-design` to npmjs.org using conventional commits, similar to epicweb-slate-ui.

**Registry:** npmjs.org (public, easy consumer access)
**Git author:** Juri Strumpflohner <juri.strumpflohner@gmail.com>

## Files to Create/Modify

### 1. `tools/release.ts` (CREATE)

Custom release script that:

- Copies packages to `build/` directory (excluding node_modules, test files)
- Calls `releaseVersion()` with conventional commits
- Calls `releaseChangelog()` for project + workspace changelogs
- Copies generated CHANGELOGs to build dir
- Calls `releasePublish()` to npm with public access

### 2. `nx.json` (MODIFY)

Add release config + targetDefaults:

```json
"targetDefaults": {
  ...existing,
  "nx-release-publish": {
    "options": {
      "packageRoot": "build/{projectRoot}"
    }
  }
},
"release": {
  "version": {
    "generatorOptions": {
      "specifierSource": "conventional-commits",
      "packageRoot": "build/{projectRoot}",
      "currentVersionResolver": "git-tag",
      "skipLockFileUpdate": true
    }
  },
  "changelog": {
    "workspaceChangelog": {
      "createRelease": "github"
    },
    "projectChangelogs": true
  }
}
```

### 3. `package.json` (MODIFY)

Add release script + deps:

```json
"scripts": {
  "release": "pnpm nx run-many --target=build && tsx tools/release.ts"
},
"devDependencies": {
  ...existing,
  "tsx": "^4.19.0",
  "fs-extra": "^11.1.1",
  "@types/fs-extra": "^11.0.4"
}
```

### 4. `.github/workflows/publish.yml` (CREATE)

Manual trigger workflow:

- Checkout with full history + tags
- Setup Node + pnpm
- Install deps
- Configure git user
- Run `pnpm release`
- Env: `GITHUB_TOKEN`, `NPM_TOKEN`

### 5. `packages/tusky-design/package.json` (MODIFY)

Add publishConfig:

```json
"publishConfig": {
  "access": "public"
}
```

## Execution Order

1. Add deps to root package.json (`tsx`, `fs-extra`, `@types/fs-extra`)
2. Create `tools/release.ts`
3. Update `nx.json` with release config
4. Create `.github/workflows/publish.yml`
5. Add `publishConfig` to package
6. Run `pnpm install`

## Prerequisites (manual)

- NPM_TOKEN secret in GitHub repo settings (from npmjs.org account)

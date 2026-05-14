<!--
     _           _      _
 ___| |__  _   _| |_ __| | _____      ___ __        _ __ ___   __ _ _ __   __ _  __ _  ___ _ __
/ __| '_ \| | | | __/ _` |/ _ \ \ /\ / / '_ \ _____| '_ ` _ \ / _` | '_ \ / _` |/ _` |/ _ \ '__|
\__ \ | | | |_| | || (_| | (_) \ V  V /| | | |_____| | | | | | (_| | | | | (_| | (_| |  __/ |
|___/_| |_|\__,_|\__\__,_|\___/ \_/\_/ |_| |_|     |_| |_| |_|\__,_|_| |_|\__,_|\__, |\___|_|
                                                                                 |___/

  shutdown-manager  --  production shutdown orchestration for Node.js HTTP services

  Author  : Ritesh Rana  <contact@riteshrana.engineer>
  Support : https://buymeacoffee.com/ritesh.rana
  License : MIT
-->

# Contributing

Maintained by **Ritesh Rana** — `contact@riteshrana.engineer`.
If this project saves you time, you can support its development at
[buymeacoffee.com/ritesh.rana](https://buymeacoffee.com/ritesh.rana).

Thanks for your interest! Here's how to get a change merged.

## Local setup

```bash
git clone https://github.com/ambicuity/shutdown-manager.git
cd shutdown-manager
npm install
npm run verify    # typecheck + lint + test + build + publint + attw
```

Requires **Node.js ≥ 18.17**.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/) so
`release-please` can generate changelogs and bump versions automatically.

Examples:

```text
feat: add http3 attach support
fix(drain): handle keep-alive close race
docs: expand kubernetes recipe
refactor(registry): use Map for ordered groups
```

## Pull requests

1. Open an issue first for non-trivial changes so we can agree on direction.
2. One logical change per PR.
3. Add or update tests covering the change.
4. Run `npm run verify` locally before pushing.
5. The PR title should follow the same Conventional Commit format as commits.

## Style

- TypeScript strict mode, no `any`.
- Prettier and ESLint are wired; run `npm run format` and `npm run lint:fix`.
- Public API additions need a corresponding test in `tests/types/` using `expect-type`.

## Releases

Releases are fully automated by `release-please`. Once a PR is merged to
`main`, it shows up in the auto-generated release PR. Merging that release
PR triggers `npm publish --provenance`.

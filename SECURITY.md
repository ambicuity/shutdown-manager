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

# Security Policy

## Supported versions

Only the latest minor release line of `@ambicuity/shutdown-manager` receives security fixes.

| Version | Supported |
| ------- | --------- |
| 1.x     | ✅        |
| < 1.0   | ❌        |

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security bugs.

Email the maintainer at `contact@riteshrana.engineer` (or use GitHub's
private security advisory feature for this repository) with:

- A description of the issue
- Reproduction steps or a proof of concept
- Affected versions
- Suggested fix (if known)

You will receive an acknowledgement within 72 hours. We aim to publish a
patch and advisory within 14 days of disclosure for confirmed issues.

## Supply chain

- Zero runtime dependencies.
- Releases are signed via [npm provenance](https://docs.npmjs.com/generating-provenance-statements) using GitHub Actions OIDC.
- CI runs `npm audit signatures` against the dependency tree.

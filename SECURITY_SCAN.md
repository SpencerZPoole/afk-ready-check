# Security Scan Log

## 2026-05-19

- Scope: `G:\DungeonsAndDragonsDMFolder\PublicForks\afk-ready-check`
- Tooling: Endor Labs MCP `endor-cli-tools` scan.
- Scan types: `secrets`, `sast`
- Options: quick scan, JavaScript language scope.
- Initial result: one high SAST finding in `scripts/package-module.js` for a path derived from manifest data before writing the release zip.
- Remediation: constrained the packager to the fixed module id `afk-ready-check`, fixed release version `1.2.1`, and fixed release filename `afk-ready-check-v1.2.1.zip`; manifest values are now assertions instead of path inputs.
- Final Endor result: no problems found.
- Additional dependency check: `npm audit --audit-level=moderate` reported zero vulnerabilities.

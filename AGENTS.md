# Repository Guidelines

## Project Structure & Module Organization
- `cmd/chatlog/`: CLI entry (Cobra commands).
- `internal/chatlog/`: app services (HTTP/MCP/TUI), config, static assets.
- `internal/wechat*`: key extraction, decryption, data sources, models.
- `internal/mcp/`: MCP (SSE, JSON-RPC) server plumbing.
- `pkg/`: reusable utilities (compression, file ops, version, config).
- Top level: `main.go`, `Makefile`, `Dockerfile`, `docker-compose.yml`, `docs/`, `script/`.

## Build, Test, and Development Commands
- `make all` — clean, lint, tidy, test, then build.
- `make build` — build current platform to `bin/chatlog`.
- `make test` — run `go test ./...` with coverage.
- `make lint` — run `golangci-lint` over the repo.
- `make crossbuild [ENABLE_UPX=1]` — cross-compile to `bin/chatlog_<os>_<arch>`.
- Run locally: `bin/chatlog` (TUI), `bin/chatlog server` (HTTP/MCP).
- From source: `go install github.com/sjzar/chatlog@latest`.

## Coding Style & Naming Conventions
- Language: Go 1.24+. Format with `go fmt`; prefer tabs (default gofmt).
- Lint: `golangci-lint run ./...`. Fix issues before submitting.
- Packages: lower_case names; exported identifiers use CamelCase.
- Files: tests end with `_test.go`.
- Logging: match the file’s existing logger (`zerolog`/`logrus`).

## Testing Guidelines
- Framework: standard `testing`. Prefer table-driven tests.
- Location: tests live alongside code in the same package.
- Names: `TestXxx` for unit tests; keep tests deterministic and fast.
- Run: `make test` or `go test ./...`. Add coverage for new logic.

## Commit & Pull Request Guidelines
- Commits: follow Conventional Commits (e.g., `feat:`, `fix:`, `docs:`).
- PRs: include a clear description, linked issues, test evidence, and platform notes (Windows/macOS) when relevant.
- Docs: update `README.md`, `docs/mcp.md`, or `docs/prompt.md` when HTTP routes, CLI, or MCP behavior changes.
- CI hygiene: run `make lint` and `make test` locally before opening PRs.

## Security & Configuration Tips
- Never commit real chat data or secrets. Redact PII in fixtures.
- Configuration: prefer env vars (`CHATLOG_*`, e.g., `CHATLOG_DIR`, `CHATLOG_HTTP_ADDR`).
- HTTP defaults: server listens on `:5030`; static assets under `/static`.

## Agent-Specific Instructions
- Scope: this file applies repo-wide. Follow existing patterns; avoid broad refactors.
- Don’t change public APIs/CLI/HTTP without updating docs and examples.

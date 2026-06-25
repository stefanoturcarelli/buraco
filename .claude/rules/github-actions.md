---
paths:
  - '.github/workflows/**'
  - '.github/actions/**'
---

# GitHub Actions Rules

ALL workflows and composite actions must comply fully. Do NOT silently skip an item — if one genuinely doesn't apply (e.g. no cloud creds → no OIDC), state that in the conversation.

## Security (mandatory)

- Every third-party action MUST be pinned to a full commit SHA with the human-readable version in a trailing comment: `uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0`. Tag refs (`@v6`, `@main`) are forbidden — a tag can be moved to malicious code after review. Local actions (`./.github/actions/...`) are exempt; they're reviewed in this repo.
- Before pinning a JavaScript-based action, verify its `runs.using` field targets `node24` — NOT `node20` or `node16`. Check via `gh api repos/<owner>/<action>/contents/action.yml --jq '.content' | base64 -d | grep 'using:'`. Composite actions (`using: composite`) are exempt — they have no Node.js runtime of their own. Known good minimum versions: `actions/checkout` → v7+, `actions/setup-node` → v4+, `actions/upload-artifact` → v4+, `actions/download-artifact` → v4+, `actions/cache` → v4+.
- Every workflow MUST declare a top-level `permissions:` block at least privilege — start from `permissions: {}` or `contents: read` and grant additional scopes per job, never workflow-wide. Never rely on the org/repo default token permissions.
- Secrets MUST only reach commands via `env:` mappings — never interpolated inline into `run:` script text. Never echo, log, or write a secret to `$GITHUB_OUTPUT`, `$GITHUB_STEP_SUMMARY`, or an artifact. `set -x` is forbidden in any step whose environment holds a secret.
- Never interpolate untrusted input (`${{ github.event.* }}` titles, bodies, branch names, commit messages) directly into `run:` scripts — that's script injection. Pass it through an `env:` var and quote it in the shell.
- `pull_request_target` and `workflow_run` triggers require explicit justification in a comment; never combine them with a checkout of the PR's head ref without one.
- Cloud credentials MUST use OIDC where the provider supports it. A long-lived cloud key in GitHub Secrets needs a written justification in the workflow comment.

## Reliability (mandatory)

- Every workflow MUST set a `concurrency:` group, and `cancel-in-progress` MUST be a deliberate, commented choice — tests/checks cancel stale runs (`true`); anything that mutates external state (deploys, branch pushes, PR creation) MUST be `false` so a run is never killed mid-mutation.
- Every job MUST set `timeout-minutes:`; steps that can plausibly hang (network waits, polling loops, deploys) MUST set their own step-level timeout too. Never ship a job that can sit on the 6-hour runner default.
- Every multi-line `run:` script MUST start with `set -euo pipefail`. A silently-failing middle command in a default shell is a green build lying to you.
- `push` triggers MUST use `paths:` / `paths-ignore:` to skip irrelevant changes — EXCEPT jobs that are required status checks on protected branches: those MUST always run and report on PRs, never path-filter them. Getting this wrong silently blocks every PR on a check that never fires.
- A step that retries MUST distinguish transient failures (network, 5xx) from deterministic ones and bail immediately on the latter. Blanket retry-on-any-failure hides real breakage and burns 3× the wall clock to report it.

## Cache + reuse (mandatory)

- Cache keys MUST hash the files that define the dependencies (`hashFiles('deno.json', '**/import_map.json', lockfiles)`) — never a static string, never `github.sha` (one is a stale-forever cache, the other never hits).
- Every `actions/cache` use MUST define `restore-keys:` fallbacks so a key miss degrades to a partial restore instead of a cold start.
- A step sequence repeated in 2+ jobs MUST be extracted into a composite action under `.github/actions/`. Copy-pasted setup blocks WILL drift apart.
- Cross-job values MUST pass via `outputs` + `needs:`. Artifacts are for files a human or later run downloads, not for piping a string between jobs.

## Observability (mandatory)

- Diagnostics (logs, test reports, screenshots) MUST be uploaded with `if: always()` / `if: failure()` / `if: cancelled()` — a red job whose evidence died with the runner has to be re-run just to see the error, which doubles every debugging cycle.
- Parseable build/test errors MUST surface as annotations (`::error file=...::` / `::warning::`) so they land on the PR diff, not page 7 of a log.
- Jobs that produce countable results (test totals, build sizes, seeded rows) MUST write them to `$GITHUB_STEP_SUMMARY` — the summary is what humans actually read.
- When debugging runner resource exhaustion (OOM, disk-full), add `df -h` / `free -m` checkpoints between heavy steps; remove them when the investigation closes.

## Polish (mandatory)

- `actionlint` MUST pass on every workflow file, before committing. It's installed locally (`/opt/homebrew/bin/actionlint`); run it — don't wait for review to catch what a linter catches in 2 seconds.
- Every `workflow_dispatch` input MUST be typed — `type: choice` + `options:` for enumerable values, `type: boolean` for flags; bare strings only for genuinely free-form input. A destructive dispatch MUST gate on an explicit confirmation phrase.
- Every manually-dispatched workflow MUST be documented (what it does, when to trigger it, what to coordinate first) in the repo CLAUDE.md AND a header comment in the workflow itself.

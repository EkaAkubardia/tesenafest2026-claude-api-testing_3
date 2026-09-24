# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Playwright + TypeScript API test framework (no browser) for the **Todoist API v1** on production (`https://api.todoist.com/api/v1/`), run against a free Todoist account. Requirements live in `brief.md` (scope, conventions, git workflow, definition of done), test cases in `Test Cases for automation.md`, and the design in `docs/test-architecture-plan.md`. Read the brief before starting a new issue.

## Commands

Node 24 (`.nvmrc`). `npm ci` installs dependencies and the husky hooks. Copy `.env.example` to `.env` and set `TODOIST_API_TOKEN`.

```sh
npm run lint              # ESLint (typescript-eslint strict type-checked + eslint-plugin-playwright)
npm run format:check      # Prettier (npm run format to fix)
npm run typecheck         # tsc --noEmit
npm test                  # all tests
npm run test:smoke        # --grep @smoke

npx playwright test tests/tasks/create-task.spec.ts   # one file
npx playwright test --grep @TC-002                    # one test case by tag
npx playwright test tests/tasks --repeat-each=3       # check a new test for flakiness
```

Spec files run only through the Playwright runner (not `ts-node`). Scripts in `scripts/*.mts` run directly with `node` (Node 24 type stripping), for example `node scripts/update-openapi.mts` to refresh the pinned spec.

## Architecture

- **Import everything for tests from `src/fixtures`**: `test` (merged fixtures), `expect` (with `toMatchSchema`) and `Schema`. Fixtures: `api` (resource clients), `apiRequest`, `unauthenticatedApi` / `apiWithToken(token)` (negative auth tests), `testData`, and per worker `account` / `accountTimezone`.
- **Clients** (`src/clients/`): `BaseClient` plus one thin client per resource (projects, tasks, labels, comments, user). Typed methods (`create`, `get`, `update`, `delete`, `list`, tasks also `close`/`reopen`) throw `ApiError` on non-2xx. `send(method, path, { body, query })` returns the raw `APIResponse` whatever the status; use it when the test asserts the exact status code. `list` follows the v1 pagination (`{ results, next_cursor }`) via `listAll`. Payload/response types in `src/clients/types.ts` are named after the OpenAPI components. Sections are intentionally not implemented.
- **Test data and cleanup** (`src/data/`, `src/fixtures/data.fixture.ts`): builders create payloads named `autotest-<run id>-<kind>-<random>`. `testData.create*` creates through the API and registers the id; anything created another way (for example via `send`) must be registered with `testData.track(kind, id)`. Teardown deletes in reverse order and ignores 404. The run id is fixed once in `playwright.config.ts` (main process) and shared with workers through the environment. `src/global-setup.ts` deletes `autotest-` projects, labels and Inbox tasks older than 1 hour (the timestamp is parsed from the run id), which protects the free plan project limit.
- **Schema validation** (`src/schemas/`): the OpenAPI spec is pinned in `openapi.json` and compiled with Ajv 2020. `Schema.task`, `Schema.project`, etc. map to component names; add a mapping in `validator.ts` for new ones.
- **Dates**: assert dates in the account timezone (`accountTimezone` + `src/utils/dates.ts`: `todayIn`, `tomorrowIn`, `addDays`), never the runner clock.
- **Config**: `TEST_ENV` (default `prod`) selects `config/<env>.ts`, which only holds the base URL. New environments are a new file registered in `config/index.ts`.
- **Token security** (the repo is public): `src/reporters/redact-reporter.ts` must stay the **first** reporter in `playwright.config.ts`. It synchronously strips the token from traces, attachments and errors before the HTML reporter copies them. CI runs `scripts/check-no-token.mts` before any artifact upload. `no-console` is an ESLint error outside `scripts/`.

## Writing tests

For the full step-by-step recipe (probing the API, leftover check, PR), use the `writing-api-tests` skill in `.claude/skills/`.

Pattern (see `tests/projects/create-project.spec.ts`):

```ts
test(
  'TC-00X <name from the test case file>',
  { tag: ['@TC-00X', '@smoke'] },
  async ({ api, testData }) => {
    await test.step('Readable step name', async () => {
      /* ... */
    });
  },
);
```

- Tags: the TC id plus the suite: Wave 1 `@smoke` (TC-001–005), Wave 2 and 4 `@regression` (TC-006–009, TC-012–013), Wave 3 `@e2e` (TC-011), Wave 5 `@negative` (TC-014–015). TC-010 and sections are out of scope.
- One behavior per test; multi-input cases get suffixes (`TC-014a`, `TC-015b`). Target spec files per test case are listed in `docs/test-architecture-plan.md`.
- Check a response against the schema, then load the resource again by ID to prove it was stored, not only echoed back.
- Where the expected result is unclear (status codes in TC-014/015, defaults in TC-007), call the real API first, assert the observed behavior and list it as an assumption in the PR description.
- Features that the free plan lacks: `test.fixme(true, '<reason>')`.

## Git workflow

- Issue → branch `<issue id>-<short-description>` → PR. Commit messages must start with the issue id: `#12 Add tasks API client` (`commit-msg` hook; `core.commentChar` is `;` so `#` lines survive the editor). `pre-push` blocks pushes to `main`; `pre-commit` runs lint-staged.
- Issues use the forms in `.github/ISSUE_TEMPLATE/`; labels are defined in `.github/labels.yml` (`type:`, `priority: P0–P3`, `status:`). `issue-priority.yml` sets the priority label from the form. PRs use `.github/pull_request_template.md` with `Closes #<id>`.
- Per the brief, Claude does not merge PRs: it reviews its own PR, fixes the findings, and a human reviews and merges. Start the next issue from the updated `main`.
- CI: `pr.yml` runs lint, format, typecheck and all tests on every PR (never `pull_request_target`); `smoke.yml` runs `@smoke` hourly on `main` and opens or comments on a `smoke-failure` issue. Both share the `todoist-account` concurrency group (one shared account), CI uses 2 workers and 1 retry, and tests that pass only on retry are reported in the PR.

---
name: writing-api-tests
description: Use when implementing a test case (TC-0xx) or a test-case GitHub issue in this Todoist API test repo, adding a spec to tests/, or when a new test fails locally or in CI.
---

# Writing API tests

## Overview

One test case = one issue = one branch = one PR. Every test proves the API **stored** the data (create, then load again by ID), cleans up everything it created, and is verified against the real account before the PR. Conventions (tags per wave, suffixes, architecture) are in `CLAUDE.md`; this is the working recipe.

## Before writing

1. `gh issue view <n>`: steps, expected result, target spec file, tags. If the issue's file already exists (e.g. TC-003 goes into `tests/tasks/create-task.spec.ts`), add another top-level `test(...)` to it.
2. Start from the updated `main`. If an earlier PR is still open (and you need its files), ask the user whether to wait or branch now. Branch now = branch from that PR's branch, open the PR with `--base <that branch>` and say in the body that it depends on it; GitHub retargets it to `main` when the base is merged and deleted.
3. `git switch -c <n>-tc-0xx-<short-name>` (e.g. `6-tc-003-task-due-date`); `gh issue edit <n> --add-label "status: in-progress" --remove-label "status: triage"`.
4. Unsure the feature is on the free plan, or what the API returns (status codes, defaults)? Probe it with the real token before asserting:
   ```sh
   node --env-file=.env -e "fetch('https://api.todoist.com/api/v1/labels',{method:'POST',headers:{Authorization:'Bearer '+process.env.TODOIST_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({name:'autotest-probe'})}).then(async r=>console.log(r.status, await r.text()))"
   ```
   Print status and body only, never the token or headers. Delete what the probe created (same `fetch` with `method:'DELETE'` on `/<resource>/<id>`). Not on the free plan → `test.fixme(true, '<reason>')`. Behavior that differs from the docs → assert what you observed and list it under assumptions in the PR.

## Core pattern

```ts
import type { Task } from '../../src/clients';
import { buildTask } from '../../src/data';
import { expect, Schema, test } from '../../src/fixtures';

test(
  'TC-002 A new task is created with the text that was entered',
  { tag: ['@TC-002', '@smoke'] },
  async ({ api, testData }) => {
    const payload = buildTask(); // unique autotest-<run id>- name

    const created = await test.step('Create a task with unique content', async () => {
      const response = await api.tasks.send('POST', 'tasks', { body: payload }); // send = exact status
      expect(response.status()).toBe(200);
      const task = (await response.json()) as Task;
      testData.track('task', task.id); // send bypasses testData.create*, so register for cleanup
      return task;
    });

    await test.step('Check the create response', () => {
      expect(created).toMatchSchema(Schema.task);
      expect(created.content).toBe(payload.content);
    });

    await test.step('Load the task by ID and check its text', async () => {
      const response = await api.tasks.send('GET', `tasks/${created.id}`);
      expect(response.status()).toBe(200);
      const loaded = (await response.json()) as Task;
      expect(loaded).toMatchSchema(Schema.task);
      expect(loaded.id).toBe(created.id);
      expect(loaded.content).toBe(payload.content);
    });
  },
);
```

- Data the test only needs as a precondition: `testData.createProject()` / `createTask()` etc. (typed, auto-cleaned). Use `send` only for the call under test.
- Dates: `accountTimezone` fixture + `import { tomorrowIn } from '../../src/utils/dates'` (also `todayIn`, `addDays`; not re-exported by `src/fixtures`), computed right before the request.
- Nullable fields (`due`, `parent_id`, ...): `expect(task.due).not.toBeNull()` first, then `task.due?.date`, so a failure says what is missing.
- Negative auth: `unauthenticatedApi`, `apiWithToken('bad')`.

## Verify (all must pass before the PR)

```sh
npm run lint && npm run format:check && npm run typecheck
npx playwright test <spec dir> --repeat-each=3
```

Leftover check, expect 0 for every resource the test touched (first page of 200 is enough for the test account):

```sh
node --env-file=.env -e "for (const [r,f] of [['projects','name'],['labels','name'],['tasks','content']]) fetch('https://api.todoist.com/api/v1/'+r+'?limit=200',{headers:{Authorization:'Bearer '+process.env.TODOIST_API_TOKEN}}).then(x=>x.json()).then(j=>console.log(r,'leftovers:',j.results.filter(i=>i[f].startsWith('autotest-')).length))"
```

All commands here are POSIX: run them in the Bash tool (Git Bash on Windows), not PowerShell.

## Ship

- Commit `#<n> Add TC-0xx <short summary>` (hook enforces `#<id> `), push, `gh pr create` with the body from `.github/pull_request_template.md`: `Closes #<n>`, test case table row, commands + results under "How it was tested", assumptions.
- `gh pr checks <pr> --watch`. "no checks reported" right after creating the PR means CI has not registered yet: wait ~30 s and retry.
- Run the code-review skill on the PR, fix findings. **Do not merge**: reply with the PR URL and a summary; a human merges.

## Common mistakes

| Symptom                                                 | Cause / fix                                                                                                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `'ts-node' is not recognized`                           | Specs run only via `npx playwright test`, never ts-node or "run file".                                                                                       |
| CI: `Global setup failed: TODOIST_API_TOKEN is not set` | Not the code: the repo secret is empty (log shows `TODOIST_API_TOKEN: ` instead of `***`). Ask the user to reset it; check the local token with `GET /user`. |
| `autotest-` data left after the run                     | Created via `send` without `testData.track`.                                                                                                                 |
| Test passes but proves nothing                          | Only the create response was checked; load it again by ID.                                                                                                   |
| Date test fails around midnight                         | Used the runner clock instead of `accountTimezone`.                                                                                                          |

<!-- Keep PRs small and focused on one issue. The PR title should start with the issue ID, like the commits: "#12 Add tasks API client". -->

## Related issue

Closes #

## What and why

<!-- What does this PR change, and why? Anything reviewers should look at first? -->

## Type of change

- [ ] New or changed test case(s)
- [ ] Bug fix
- [ ] Framework / tooling improvement
- [ ] CI / GitHub Actions
- [ ] Documentation

## Test cases

<!-- List added or changed test case IDs, or write "none". -->

| ID  | Title | Tags |
| --- | ----- | ---- |
|     |       |      |

## How it was tested

<!-- Commands you ran and the result, for example `npx playwright test tests/tasks`. -->

## Checklist

- [ ] `npm run lint`, `npm run format:check` and `npm run typecheck` pass
- [ ] `npm test` passes locally, and new tests pass repeatedly (`--repeat-each=3`)
- [ ] Test data is created with `testData.create*` / `testData.track` so it is cleaned up
- [ ] Tests have a `@TC-xxx` tag (and `@smoke` if they belong to the smoke suite)
- [ ] No API token, `.env` content or other secrets in code, logs or screenshots
- [ ] Docs (README, test case list) are updated if needed
- [ ] Commit messages start with the issue ID (`#<id> <summary>`)

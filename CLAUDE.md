# Contributing rules for this repo

## Pull requests target `main`

**Open every pull request against `main`.** Do not target `development`.

This changed on 2026-09-22. Before that, PRs went to `development` and a
`development` → `main` PR was opened separately in batches, which is why `main`
carries a run of "Merge pull request #N from devfoundry16/development" commits.
`development` still exists and still holds previously merged work, so do not
assume the two branches are identical — check before you branch.

## Branch from `main`, in a worktree

Do each feature or fix in its own git worktree rather than on a shared checkout,
so concurrent work cannot collide:

```sh
git fetch origin main
git worktree add ../drsahar-worktrees/<short-name> -b <type>/<short-name> origin/main
```

Existing worktrees live in the sibling directory `../drsahar-worktrees/`.
Branch names follow `fix/…`, `feat/…`, `chore/…`.

## Commit identity

Commits are authored as `devfoundry16 <petrenkoviacheslav52@gmail.com>`. This is
set in the repo-local `.git/config` and is inherited by every worktree, so it
normally applies on its own — but a **fresh clone silently inherits whatever is
in the machine's global `~/.gitconfig`**, which on at least one dev machine is a
different account. Check before your first commit on a new clone:

```sh
git config user.email   # must print petrenkoviacheslav52@gmail.com
```

Do not add co-author or "generated with" trailers to commits or PR descriptions.

## Before opening a PR

This is a pnpm workspace (`pnpm install`). Run, from the package you touched:

| Package    | Tests             | Types             | Lint                        |
|------------|-------------------|-------------------|-----------------------------|
| `apps/api` | `npx vitest run`  | `npx tsc --noEmit`| *(no eslint config — the `lint` script does not work)* |
| `apps/web` | —                 | `npx tsc --noEmit`| `npx eslint .`              |

`apps/web` carries a number of pre-existing eslint errors and warnings. Compare
the output against the base branch before assuming your change caused one.

# pnpm's check of the packages before a script

## Context

Before pnpm 12 runs a script of a folder, it checks whether the folder's `node_modules` matches its lockfile, and `verifyDepsBeforeRun` in the folder's `pnpm-workspace.yaml` says what it does when they differ. `pnpm deps:cached` is such a script, and agents run it without asking because it downloads no package, as [configuration.md](/.claude/docs/configuration.md) says. It runs in the root, `games/`, `www/` and `blog/`.

- pnpm runs a folder that has its own `package.json` and lockfile as a project of its own, and the `pnpm-workspace.yaml` of the root does not reach it, so each of these folders needs the setting in its own file.
- By default pnpm installs the packages before the script, and downloads those that the store lacks. In `blog/`, `pnpm deps:cached` with an empty store downloaded all 115 packages and succeeded.
- With `error`, pnpm stops before any script, `deps:cached` included, with `ERR_PNPM_VERIFY_DEPS_BEFORE_RUN`.
- With `warn`, pnpm warns and runs the script. In `blog/`, `pnpm deps:cached` with an empty store failed, as configuration.md says it does.
- With `false`, pnpm runs the script without the check.
- With `offline: true` in `pnpm-workspace.yaml`, or in the environment as `pnpm_config_offline`, the default installs only from the store. Then `pnpx modern-web-guidance@latest`, which [configuration.md](/.claude/docs/configuration.md) lets agents run, fails with `ERR_PNPM_NO_OFFLINE_META`, and so does every install of CI and the Dockerfiles that does not turn it off.

## Options

- The default. No script runs on packages that differ from the lockfile, but `pnpm deps:cached` downloads what the store lacks, which the permission of settings.json does not allow for.
- The default with `offline: true`. Scripts install from the store before they run and nothing downloads, but the agents' `pnpx` commands fail, and CI, the Dockerfiles and the install that downloads a missing package must each turn it off.
- `error`. No script runs on such packages and nothing downloads, but `pnpm deps:cached` cannot run when `node_modules` is missing or out of date, which is when it is needed.
- `false`. `pnpm deps:cached` downloads nothing. Other scripts, such as `pnpm test`, run on packages that differ from the lockfile without a word.
- `warn`. `pnpm deps:cached` downloads nothing. Other scripts run on such packages after a warning.

## Decision

`warn`. Against the default, `pnpm deps:cached` stays offline. Against `offline: true`, `pnpx` and the installs of CI and the Dockerfiles keep working as they are. Against `error`, it can run when it is needed. Against `false`, a script that runs on packages that differ from the lockfile says so. The price is that scripts such as `pnpm test`, `pnpm format` or `pnpm start` run on such packages until `pnpm deps:cached` or `pnpm install` runs. CI installs before it runs them.

## Consequences

- The `pnpm-workspace.yaml` of the [root](/pnpm-workspace.yaml), of [games/](/games/pnpm-workspace.yaml), of [www/](/www/pnpm-workspace.yaml) and of [blog/](/blog/pnpm-workspace.yaml).
- The `deps:cached` bullet of [configuration.md](/.claude/docs/configuration.md).

---
sidebar_position: 5
---

# Deploy and Release

A service has two environments, **staging** and **production**. Forge
deploys by committing the new version to its GitOps repo
(by default `my-org/forge-deploys`). Argo CD then applies it, and forge watches until
Argo CD reports it Synced and Healthy.

```text
push to main ──> CI builds image ──> staging (v0.3.1-rc.1)
                                        │  forge deploy promote
                                        ▼
                                     production (v0.3.1, tag + GitHub release)
```

## See What Runs Where

```sh
forge deploy status                      # every service, or this repo's service
forge deploy status payments
forge deploy status payments --env production   # one deployment in detail
forge deploy history payments --env production --limit 5
```

`status` shows the version, the image (commit), the sync and health state,
when it was deployed, by whom, and the URL.

## Deploy to Staging

Normally CI does this on every push to `main` (see [From CI](#from-ci)). By
hand:

```sh
forge deploy start payments --env staging                  # main
forge deploy start payments --env staging --ref feature/x  # a branch, tag or commit
forge deploy start --env staging --ref v1.4.2              # inside the repo
forge deploy start payments --env staging --dry-run        # resolve and check only
```

The image for the commit must exist (`ghcr.io/my-org/<service>:<sha7>`),
so CI must have built it first.

## Promote Staging to Production

```sh
forge deploy promote payments --dry-run       # what it would do, and the version
forge deploy promote payments                 # asks you to type the service name
forge deploy promote payments --yes           # no prompt
forge deploy promote payments --bump minor    # v0.3.1 -> v0.4.0 (or --bump major)
```

A promotion deploys exactly the image that runs in staging, and releases it:

- the commit gets the next final version (a patch unless you `--bump`),
- a Git tag `v0.3.1`,
- a GitHub release marked Latest, with notes since the last release,
- the image tag `ghcr.io/my-org/<service>:v0.3.1`, if the repo has a
  workflow that adds it when a release is published.

A commit that was released before keeps its version.

Any member of the service's team can promote it, and so can an admin. CI can
never do it.

### Staging must be ready

Forge promotes only a staging that works. Argo CD must report it:

- **Synced**: it runs what the deploy repo says,
- **Healthy**: its pods are up and pass their health check,
- **at its latest deploy**: not still on the deploy before.

Otherwise the promotion is refused, for admins too, and nothing changes:

```text
$ forge deploy promote payments --dry-run
error: promoting services/payments to production is denied by policy: staging is Degraded; it must be Healthy to be promoted
```

The exit code is 5. `--dry-run` checks it too, so a script can ask first.
Look at staging (`forge deploy status payments --env staging`), fix it or
wait for the deploy to finish, then promote again. There is no flag to skip
the check.

A rollback is never checked: you can always roll production back.

## Roll Back

```sh
forge deploy history payments --env production          # find the commit to go back to
forge deploy rollback payments --env production         # to the version before the current
forge deploy rollback payments --env production --to 9f8e7d6 --dry-run
forge deploy rollback payments --env production --yes
```

A rollback commits the earlier version to the GitOps repo and restores the
image of that commit. The address is worked out again from the domain that
commit asked for. Rolling back to a deploy from before public addresses does
not take the service off the internet, and a rollback never makes an internal
staging public.

## Versions

| Where | Version | Example |
| --- | --- | --- |
| Staging | A release candidate, published as a GitHub pre-release | `v0.3.1-rc.2` |
| Production | The final version, on the same commit, marked Latest | `v0.3.1` |

- Deploying the same commit again keeps its number.
- A service's first release is `v0.1.0`.
- `--bump` is only for production. A staging deploy refuses it.
- If the tag cannot be made, the deploy fails with `release_failed` before it
  changes anything. Run it again.

## From CI

The template CI deploys `main` to staging:

```yaml
  deploy:
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions: {contents: read, id-token: write}
    env:
      FORGE_API_URL: ${{ vars.FORGE_API_URL }}
    steps:
      - run: curl -fsS -o "$RUNNER_TEMP/forge" "$FORGE_API_URL/cli/forge-linux-amd64" && chmod +x "$RUNNER_TEMP/forge"
      - run: '"$RUNNER_TEMP/forge" deploy start --env staging'
```

- **No secret is needed.** With `id-token: write`, the CLI logs in with the
  job's GitHub OIDC token.
- **What that token may do:** deploy only its own repo's service, only to
  staging, only the commit the job runs at (`GITHUB_SHA`), only from the
  default branch, and follow that deploy.
- **The runner must reach the API.** `FORGE_API_URL` is an organization or
  repository variable with your Forge's address. If the API is not on the
  internet, run the job on your own runners in its network.
- **Production stays with people:** `forge deploy promote`.

## Wait or Don't Wait

Deploy, promote and rollback watch until Argo CD reports the result. To start
one and come back later:

```sh
forge deploy promote payments --yes --wait=false   # prints the operation id
forge op watch op_9f2c4a1b0c3d
```

See [Operations](09-operations.md).

## In the Dashboard

A service's page in the dashboard shows both environments, with
Promote and Roll back buttons behind a confirmation.

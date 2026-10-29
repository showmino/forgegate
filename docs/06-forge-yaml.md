---
sidebar_position: 7
---

# forge.yaml Reference

Every service has a `forge.yaml` at the root of its repo. Forge reads it from
the commit it deploys, so a change applies at the next deploy (staging) or
promote (production).

Inside a repo with a forge.yaml, commands that take a service name default to
that service.

## A Complete Example

```yaml
apiVersion: forge.dev/v1
service:
  name: payments                  # lowercase, digits, hyphens; the repo and catalog name
  displayName: Payments API       # optional, for people
  team: billing                   # the owning GitHub team
  owners: [ana@example.com]       # optional people, besides the team
  lifecycle: production           # experimental, production or deprecated
  repo: https://github.com/my-org/payments
  dependencies: [ledger]          # services this one calls
  labels: {tier: "1"}

run:
  port: 8080                      # default 8080
  health: /healthz                # default /healthz; readiness and liveness
  writable: [/var/cache/app]      # folders the app writes besides /tmp
  domain: example.com             # a platform public domain, or "none" for internal only
  host: pay                       # the name before the domain (default: the service name)
  staging:
    public: false                 # staging internal only
  replicas: 2                     # production, 1 to 10; staging always runs 1
  autoscaling: {max: 4}           # production grows on CPU up to this many pods
  resources:
    requests: {cpu: 100m, memory: 128Mi}
    limits: {cpu: 250m, memory: 256Mi}
  env:
    LOG_LEVEL: info
  secrets:
    - name: stripe                # becomes the Kubernetes Secret stripe-secret
      item: vaults/Apps/items/payments-stripe
      env: {STRIPE_KEY: credential}   # variable: field of the item
  jobs:
    - name: cleanup
      schedule: "0 3 * * *"
      command: [node, scripts/cleanup.js]

resources:                        # only where the platform offers them; see Resources
  - name: main
    type: postgres
    storage: 5Gi
    environments:
      production: {instances: 2}

docs:                             # optional: the order and titles of docs pages
  - path: index.md
  - path: runbook.md
    title: Runbook
```

## service

| Field | Required | Meaning |
| --- | --- | --- |
| `name` | yes | The service's name. Lowercase letters, digits and hyphens, at most 63 characters |
| `team` | yes | The GitHub team that owns it (`forge team list`) |
| `displayName` | no | A name for people |
| `owners` | no | People who own it, besides the team |
| `lifecycle` | no | `experimental` (default), `production` or `deprecated` |
| `repo` | no | The repo's URL. CI deploys only work when it is exactly `https://github.com/<org>/<repo>` |
| `dependencies` | no | Names of services this one depends on (`forge service deps`) |
| `labels` | no | Free key/value pairs |

## run

All fields are optional. With no `run` section, a service runs one pod on
port 8080 with the probe on `/healthz`.

| Field | Meaning | More |
| --- | --- | --- |
| `image` | Only for a service without a repo: the image it runs, such as `nginxinc/nginx-unprivileged:1.27`, which Forge writes in full (`docker.io/nginxinc/nginx-unprivileged:1.27`). It must run as a non-root user given by number. Such a forge.yaml lives in the deploy repo; a repo's own forge.yaml may not have it | [Create a service](04-create-a-service.md#run-an-image-instead-of-a-template) |
| `port` | The HTTP port the app listens on (also given to it as `$PORT`) | |
| `health` | The path probed for readiness and liveness. It should answer 200 without calling other services | |
| `writable` | Folders the app writes besides `/tmp`, up to 8, such as `/var/cache/nginx`. The root filesystem is read-only; each folder starts empty on every start, as `/tmp` does. Not `/`, `/tmp`, `/proc`, `/dev`, `/sys` or `/var/run/secrets`, nor a folder inside them | [Create a service](04-create-a-service.md#run-an-image-instead-of-a-template) |
| `domain` | One of the platform's public domains (`forge domain list`), or `none` for no public address. Refused when the platform has none | [Addresses](08-addresses.md) |
| `host` | The name before the domain, when it is not the service's own. `@` is not allowed here; use `forge service address` | [Addresses](08-addresses.md) |
| `staging.public` | `false` keeps staging on its internal address while production stays public | [Addresses](08-addresses.md) |
| `replicas` | Production's pod count, 1 to 10. Staging runs 1 | [Run options](09-run-options.md) |
| `autoscaling.max` | Production grows from `replicas` up to this many pods on CPU | [Run options](09-run-options.md) |
| `resources` | CPU and memory requests and limits per pod | [Run options](09-run-options.md) |
| `env` | Plain environment variables | [Run options](09-run-options.md) |
| `secrets` | 1Password items, given to the app as environment variables | [Run options](09-run-options.md) |
| `jobs` | Cron jobs that run the service's image, with its env and secrets | [Run options](09-run-options.md) |

## resources

Things a service needs besides its pods: today, one Postgres database. See
[Resources](14-resources.md).

## docs

The order and titles of the pages under `docs/`. Pages not listed come after
the listed ones, in alphabetical order. See [Service docs](13-service-docs.md).

## Rules to Know

- **Everything must fit the namespace's quota**: requests 2 CPU / 2Gi,
  limits 4 CPU / 4Gi, 15 pods. That counts the replicas (or
  `autoscaling.max`), one extra pod during a rollout, one per cron job, and the
  database's instances. `forge service options check` does the sum for you.
- **A new field needs a forge-api that knows it.** An older API rejects
  unknown fields, and every deploy of the service fails. Check `forge version`
  before you use a field that is new.
- **Check before you push:** `forge service options check` checks the `run`
  options, and `forge docs lint` checks the docs. Neither needs a login.
- **Change run options with the CLI** to keep the file's comments:
  `forge service options set replicas=3 env.LOG_LEVEL=debug`.

---
sidebar_position: 10
---

# Run Options

The `run` section of forge.yaml says how a service runs: how many pods,
how much CPU and memory, environment variables, secrets, cron jobs and
autoscaling. Every field is optional.

## See What Each Environment Gets

```sh
forge service options check              # this repo
forge service options check ../payments  # another checkout
```

This needs no login. It runs the same checks forge-api runs when it deploys,
and prints a table of staging against production.

## Change Them

Edit forge.yaml by hand, or with the CLI, which keeps the file's comments and
refuses a result that does not pass the check:

```sh
forge service options set replicas=3 autoscaling.max=6
forge service options set env.LOG_LEVEL=debug resources.limits.memory=256Mi
forge service options set autoscaling.max=        # an empty value removes the key
forge service options set replicas=2 --dir ../payments
```

| Key | Meaning |
| --- | --- |
| `replicas` | Production's pod count, 1 to 10 |
| `autoscaling.max` | Production grows on CPU up to this many pods |
| `resources.requests.cpu`, `resources.requests.memory` | What each pod is guaranteed |
| `resources.limits.cpu`, `resources.limits.memory` | The most each pod may use |
| `env.<NAME>` | A plain environment variable |

Secrets and jobs are lists: edit them in forge.yaml.

Then push. The change applies at the next deploy (staging) and promote
(production).

## Replicas and Autoscaling

```yaml
run:
  replicas: 2            # production starts here
  autoscaling: {max: 6}  # and grows on CPU up to 6
```

Staging always runs one pod.

## Resources

```yaml
run:
  resources:
    requests: {cpu: 100m, memory: 128Mi}
    limits: {cpu: 500m, memory: 512Mi}
```

Without them, pods get the namespace's defaults.

## Environment Variables

```yaml
run:
  env:
    LOG_LEVEL: info
    API_URL: https://ledger.example.com
```

Forge also sets:

| Variable | Value |
| --- | --- |
| `PORT` | `run.port` |
| `FORGE_ENVIRONMENT` | `staging`, `production` or `preview`: where this copy of the app runs |
| `DATABASE_URL` | The connection string, when the service has a database (not in previews) |

Never put a secret in `env`: use `secrets`.

### Calling Another Service

`env` is the same in staging and production, and a promotion copies staging
as it is. So an address in `env` would make production call the staging copy
of the other service. Build the address from `FORGE_ENVIRONMENT` instead, so
each environment calls its own:

```js
const ledger = `http://ledger.${process.env.FORGE_ENVIRONMENT}.apps.example.com`;
```

A preview has no copy of the other service: point it at staging, or leave
the feature off there.

## Secrets From 1Password

```yaml
run:
  secrets:
    - name: stripe                           # the Secret is called stripe-secret
      item: vaults/Apps/items/payments-stripe
      env:
        STRIPE_KEY: credential               # variable: field of the item
        STRIPE_WEBHOOK: webhook-secret
```

- Secrets need the 1Password operator on the cluster. The platform team
  switches them on by naming the vaults services may read (the chart's
  `secrets.vaults`); until then a deploy with `secrets` is refused.
- The item must be in one of those vaults (here `Apps`).
- Name the item by its title, not its 1Password ID.
- The platform's own credentials (the chart's `secrets.deniedItems`) are
  denied. A deploy that names one is refused.
- Only the fields you list become variables. Map only what the app needs.
- Two services can read the same item. That keeps one value in one place,
  for example a token both sides must agree on.

## Cron Jobs

```yaml
run:
  jobs:
    - name: cleanup
      schedule: "0 3 * * *"                 # standard cron, in the cluster's time zone
      command: [node, scripts/cleanup.js]
```

A job runs the service's image with its env and secrets.

## The Quota

Everything that may run at once in one environment must fit the namespace's
quota:

| | Requests | Limits |
| --- | --- | --- |
| CPU | 2 | 4 |
| Memory | 2Gi | 4Gi |
| Pods | 15 | |

The sum counts the replicas (or `autoscaling.max`), one more pod while a
rollout replaces them, one per cron job, and the database's instances.
`forge service options check` does the sum and says which value to lower.

## At Create Time

Templates offer these as flags (`forge template get <template>` lists which):

```sh
forge create shop --template nextjs --team web --replicas 2 --env LOG_LEVEL=info \
  --secret stripe=vaults/Apps/items/shop-stripe:STRIPE_KEY=credential \
  --job 'cleanup=0 3 * * *:node cleanup.js' --autoscaling-max 4
```

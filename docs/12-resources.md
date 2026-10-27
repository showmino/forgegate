---
sidebar_position: 12
---

# Resources (Databases)

Resources need an OpenTofu runner and CloudNativePG on the cluster, which the
Helm chart does not install yet. Without them, `forge resource` answers
`resources are not configured on this Forge API`.

A service declares what it needs besides its own pods under `resources:` in
forge.yaml. Today that is one Postgres database (CloudNativePG). You **plan**
a change, Forge checks it against policy, and then you **apply** exactly that
plan, like `tofu plan` and `tofu apply`.

## Declare a Database

```yaml
resources:
  - name: main
    type: postgres
    storage: 5Gi              # whole Gi, at least 1Gi (default 1Gi)
    environments:             # optional overrides per environment
      production:
        storage: 20Gi
        instances: 2          # 1 to 3; default 1 in staging, 2 in production
```

One `postgres` entry per service. The Postgres version, storage class and pod
sizes are the platform's.

## Plan, Then Apply

```sh
forge resource plan --env staging
#   Plan resourcePlans/7f3a91c2b04e for payments (staging)
#     + postgres main   storage 5Gi, instances 1
#   Policy: passed
forge resource apply --env staging            # your newest ready plan for staging
forge resource apply resourcePlans/7f3a91c2b04e --yes
forge resource apply --env production --dry-run
```

A plan is used once and expires after 24 hours. Apply refuses a plan that was
used, has expired, or was made before forge.yaml or the resources changed
(exit 6). Make a new plan.

Then **deploy** the service. The next deploy gives the app `DATABASE_URL`;
a running app does not change when a database is applied.

## When an Apply Fails or Is Cancelled

An apply waits up to 10 minutes for the database to be healthy. When it is
cut short (you cancel it, or the database is not healthy in time), Forge keeps
what was made, and the resource shows `failed`:

```sh
forge resource plan --env staging     # no changes, and:
#   Forge's records differ from what exists: apply this plan to put them right.
forge resource apply --env staging    # puts Forge's records right
```

No `--allow-destroy` is needed. While the database is still starting, that
apply ends with `not_ready` ("main is not healthy yet …"); wait, then plan and
apply again. `forge resource get` shows the live health.

## Plans From CI

A service's own CI may plan its resources (for example to show the plan in a
pull request); it may not apply them. Applying is for people on the owning
team, or admins.

## See What Exists

```sh
forge resource list                       # this repo's service, or all
forge resource list payments --env production -o json
forge resource get payments/staging/main
```

## The Policy

| Rule | Result |
| --- | --- |
| Deleting or replacing a database without `--allow-destroy` | denied |
| Storage above 20Gi in staging or 50Gi in production | denied |
| Making storage smaller | denied |
| Production with fewer than 2 instances, or any environment with more than 3 | denied |
| Staging with more than 1 instance | warning |

A denied plan prints each reason and exits 5.

## Grow a Database

Raise `storage` or `instances`, then plan and apply. Volumes grow in place.

## Remove a Database

1. Remove it from forge.yaml.
2. `forge resource plan --env staging --allow-destroy`
3. `forge resource apply --env staging` (type the resource name to confirm).
4. Deploy, so the app loses `DATABASE_URL`.

The volumes stay on disk, so the platform team can recover the data by
hand. A service cannot be deleted while it still has resources.

## Previews

Preview environments get no database and no `DATABASE_URL`.

---
sidebar_position: 13
---

# The Catalog

The catalog is the list of every service: its name, owning team, owners,
lifecycle, tier, SLO target, repo, dependencies and labels.

## Find Services

```sh
forge service list
forge service list --team billing
forge service list -o json | jq -r '.services[].name'
forge service get payments
forge service get payments -o yaml
```

Inside a repo with a forge.yaml, `forge service get` with no name shows that
repo's service.

## Who Owns It, What It Needs

```sh
forge service owners payments
forge service deps ledger        # the services ledger depends on
forge team list                  # the GitHub teams a service can belong to
```

## Change a Service's Catalog Entry

Only the flags you pass change:

```sh
forge service update payments --lifecycle production
forge service update payments --team billing
forge service update payments --add-owner li@example.com --remove-owner ana@example.com
forge service update payments --tier 1 --slo 99.95%
forge service update payments --display-name "Payments API" --label cost-center=cc-1042
forge service update payments --depends-on ledger --depends-on fx
forge service update payments --repo https://github.com/my-org/payments
forge service update payments --lifecycle deprecated --dry-run
```

| Lifecycle | Meaning |
| --- | --- |
| `experimental` | New, not relied on yet (the default) |
| `production` | Others rely on it |
| `deprecated` | Being retired. Do not build on it |

| Tier | Meaning |
| --- | --- |
| `1` | Critical: an outage stops the business |
| `2` | High: an outage hurts, with a way around it |
| `3` | Medium: it can wait for working hours |

The SLO target is the availability the service promises, written as a
percentage such as `99.9%`. `--tier 0` and `--slo ""` clear them. Both can
also start in forge.yaml (`service.tier`, `service.slo`), which Forge reads
when it creates or registers the service; after that, change them here.

## Applications

Services that belong together (a web app, its API and its worker) can be
grouped into an application. Each service stays what it is, with its own
page, deploys and history; the application is the name they share.

Make a service a part of an application:

```sh
forge service update shop --application shop
forge service update shop-api --application shop
forge service update shop-worker --application shop
```

A new service can also start as a part, with `service.application` in its
forge.yaml. `--application ""` takes a service out again. An application
exists while a service names it: there is nothing to create first and
nothing to delete after.

```sh
forge application list
forge application get shop
```

`list` shows each application with its team and how many parts it has.
`get` shows every part with the version it runs in staging and in
production, and the parts it links to; a part that is not healthy says so
next to its version.

Two rules keep applications in order:

- **Every part has the same team.** A service of another team is refused.
  To move an application to another team, take its parts out, move them,
  and put them back.
- **An application's name is its own.** It may equal the name of one of
  its parts (`shop` with the parts `shop`, `shop-api` and `shop-worker`),
  but not the name of a service outside it.

### Linking Parts

A part that uses another part of its application names it in `run.links`
in its forge.yaml:

```yaml
service:
  name: shop
  team: billing
  application: shop
run:
  links: [shop-api]
```

At every deploy and promote Forge gives the pods one variable per link: the
part's name in capitals, with `-` as `_`, then `_URL`. Here that is
`SHOP_API_URL`, and it holds the address of `shop-api` inside the cluster in
the same environment:

| Environment | `SHOP_API_URL` |
| --- | --- |
| staging | `http://shop-api.shop-api-staging.svc` |
| production | `http://shop-api.shop-api-production.svc` |

So staging calls staging and production calls production, with nothing to
build from `FORGE_ENVIRONMENT`. The address is inside the cluster: it works
whether or not the linked part has a public address.

```js
const res = await fetch(`${process.env.SHOP_API_URL}/orders`);
```

What to know:

- Both services must be parts of the same application in the catalog
  (`forge application get shop`). Otherwise the deploy is refused, and
  says which service is missing from the application.
- Forge does not check that the linked part runs yet, and orders nothing:
  deploy the parts in any order, and let your code cope with a neighbour
  that is briefly not there.
- A name in `links` cannot also be set in `env` or `secrets`
  (`SHOP_API_URL` is then taken), and a service cannot link to itself.
- A part that runs a chart can be linked to (the address is the Service its
  `chart.expose` names), but cannot have links of its own.
- A preview gets no links, as it gets no `env`.
- `forge application get shop` shows each part's links in the column
  LINKS TO.

### Sharing a Database

A database belongs to the service that declares it. Another part of the
same application, such as a worker next to its API, can use it too.

1. **The owning part shares it.** Add `share: true` to the resource in its
   forge.yaml, then deploy the part to each environment where the database
   exists:

   ```yaml
   service:
     name: shop-api
     team: billing
     application: shop
   resources:
     - name: main
       type: postgres
       share: true
   ```

2. **The other part links to it**, by the owning part's name and the
   resource's name, and is deployed:

   ```yaml
   service:
     name: shop-worker
     team: billing
     application: shop
   run:
     links: [shop-api/main]
   ```

The linking part's pods get `DATABASE_URL` for that database: the same
database and the same credentials the owning part has. In
`forge application get shop` the link shows as `shop-api/main`.

What to know:

- The deploy of the linking part is refused until the owning part runs in
  that environment with the database shared. The message says which step is
  missing. This holds for a promote too: production's owning part must
  share production's database.
- A service has one database: its own or a linked one. A service with
  `resources` of its own cannot link to another part's database.
- Forge copies the database's URL into the linking part's namespace at each
  deploy of that part. If the database's password changes, deploy the
  linking part again to pick it up.
- Removing the link from `run.links` and deploying removes the copy, and
  the pods lose `DATABASE_URL`.
- To stop sharing, remove `share: true` and deploy the owning part. Forge
  then removes the copy from every part that linked to the database: their
  pods lose it when they next start, and those parts cannot be deployed
  again until the link is out of their forge.yaml. Remove the links first
  if the parts should keep running.
- A service cannot change application (`forge service update
  --application`) while what it runs has links or shares its database.
  Remove them from its forge.yaml and deploy it first.
- The linking part's pods must be able to reach PostgreSQL in the owning
  part's namespace. If the cluster restricts traffic between namespaces,
  the platform team has to allow it.
- Sharing needs the platform to run Forge from the `forge` chart at 0.58.0
  or later.

### Releasing an Application

Each part deploys to staging on its own, from its own CI. Production moves
together.

See what a promotion would do, then do it:

```sh
forge application promote shop --dry-run
forge application promote shop
```

The promotion is one operation. It takes every part whose staging differs
from production and promotes them one at a time: a part after the parts it
links to, and otherwise by name. Each part is promoted exactly as
`forge deploy promote` would do it, under the same
[rules](22-rules.md), and gets its own version. A part that production
already runs is left alone.

**If a part fails**, the promotion stops, and that part and the parts
promoted before it are put back to what they ran. Production is not left
half promoted. The operation ends as failed and says which part failed and
what was put back. A part that was new in production has nothing to go back
to: it stays, and the message says so.

A promotion that succeeds records a **release**: a number, and what every
part ran in production then.

```sh
forge application releases shop
```

```text
RELEASE   WHEN               BY                PARTS                                               NOTE
7         2026-11-16 14:02   ana@example.com   shop v1.4.0, shop-api v2.1.3, shop-worker v0.9.0
6         2026-11-12 09:40   ana@example.com   shop v1.3.2, shop-api v2.1.2, shop-worker v0.9.0
```

To go back a release, or to any release by its number:

```sh
forge application rollback shop --dry-run
forge application rollback shop
forge application rollback shop --to 5
```

Without `--to`, a rollback goes to the release before the newest. If
production has moved since the newest release was recorded (someone
promoted a single part, say), it goes to the newest release instead: the
last state known to be good. `--dry-run` shows which.

A rollback returns every part to what it ran in that release, and is
recorded as a new release with a note. A part that already runs that
version is left alone, and so is a part that joined the application after
that release. If a part fails during a rollback, the rollback stops: fix
the cause and run it again.

Both commands ask you to type the application's name, unless you pass
`--yes`. They need what promoting one part needs: membership of the owning
team (a [personal token](02-install-and-login.md) needs the deploy scope).
CI cannot call them.

While a promotion or rollback of the application runs, production of every
part is locked: a deploy of a part to production waits its turn, and a
second promotion of the application is refused. If a part changed between
the moment you asked and the moment the operation got its locks, it does
nothing and says so: run it again.

Two things a put back does not undo. A version tag that was cut for a part
stays in its repo; the next promotion of that commit reuses it. And if the
Forge API restarts in the middle of the operation, the parts stay as far as
it got: check with `forge application get shop`, then promote again or roll
back.

You can still promote or roll back a single part with `forge deploy
promote` and `forge deploy rollback`. The releases do not record that, so
production then differs from the newest release until the next promotion of
the application.

## Teams

`forge team list` shows the organization's teams and how many members each
has, read from GitHub.

Keep forge.yaml's `service:` section in step with the catalog entry.

## The Owner Team's Access to the Repo

A service's owner team gets the role **Maintain** on the service's GitHub
repo (forge-api v0.17.0 and later). The team can push, merge, and manage
issues and settings. It cannot delete the repo or change who has access.

| When | What Forge does on GitHub |
| --- | --- |
| `forge create` | Gives the team the new repo right after creating it. If GitHub refuses, the create fails and the repo is deleted again |
| `forge service register` | Gives the team the repo before it registers the service. If GitHub refuses, nothing is registered |
| `forge service update --team` or `--repo` | Gives the new team (or the new repo) first. If GitHub refuses, nothing changes. Then takes the access of the old team away, unless another service of that repo still belongs to it |
| `forge service delete` | Nothing: the repo and its access stay |

Forge never lowers a role: a team that is already admin of the repo stays
admin, and a move only takes away the role Maintain, never Admin.

When repository protection is enabled, the owner team is also the only
`CODEOWNERS` team for the repo. Its approval is required for pull requests to
`main`. An approved alternate reviewer team can replace it; the alternate
must already have Maintain access. Revoking that exception requires the
alternate team to approve the PR that restores the owning team in `CODEOWNERS`.
An active team-of-one production exception for an infrastructure repo waives
approving reviews for that repo's pull requests; the pull-request requirement
and required checks remain. See [A Team of One](21-infrastructure-repos.md#a-team-of-one).

Only repos in your organization are changed. To check who has
access, open the repo's **Settings → Collaborators and teams**, or run:

```sh
gh api repos/my-org/payments/teams --jq '.[] | "\(.slug) \(.permission)"'
```

If a create fails at the step "Giving the team access", the error names the
team. Check that the team exists in the organization (`forge team list`).

## Add an Existing Service

```sh
forge service register                  # from ./forge.yaml
forge service register payments --team billing --repo https://github.com/my-org/payments --lifecycle production
forge service register ledger --team billing --depends-on payments --dry-run
```

`forge create` registers new services itself. See [Bring an existing repo](05-bring-an-existing-repo.md)
for the whole move.

## Delete a Service

```sh
forge service delete payments --dry-run
forge service delete payments            # asks you to type the name
forge service delete payments --yes
```

This removes, in order: its preview environments, its staging and production
deployments with their namespaces, and last its catalog entry. **The GitHub
repo is kept**: delete or archive it on GitHub if you mean to.

If the delete fails half way, the service stays in the catalog and you can run
the delete again. A service that still has [resources](14-resources.md) must
remove them first.

The name is never taken from forge.yaml: you always type it.

## In the Dashboard

The **Catalog** (`https://forge.example.com/services`) lists every service
with its owner, its tier and the environment where it hurts most, broken
first. Search by name or team, or pick an owner, a tier or a status
(**Needs attention**, **Healthy**, **Ready to promote**: staging runs a
healthy commit production does not). Its tabs lead to the templates, the
resources of every service and, for admins, the clusters.

Each service's Settings page changes the owner, contacts, lifecycle, tier
and SLO target, and
its Danger zone holds the delete.

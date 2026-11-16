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

A part that calls another part of its application names it in `run.links`
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

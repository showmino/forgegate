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

## A Team's On-Call

`forge team list` shows each team's members (from GitHub) and its on-call
rotation, the name your paging tool gives it. An admin sets it:

```sh
forge team update billing --oncall billing-primary
forge team update billing --oncall ""      # remove it
```

A team that owns services but has no rotation is pointed out on the
dashboard's Ownership page and on an admin's home page.

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

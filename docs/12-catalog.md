---
sidebar_position: 13
---

# The Catalog

The catalog is the list of every service: its name, owning team, owners,
lifecycle, repo, dependencies and labels.

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
forge service update payments --display-name "Payments API" --label tier=1
forge service update payments --depends-on ledger --depends-on fx
forge service update payments --repo https://github.com/my-org/payments
forge service update payments --lifecycle deprecated --dry-run
```

| Lifecycle | Meaning |
| --- | --- |
| `experimental` | New, not relied on yet (the default) |
| `production` | Others rely on it |
| `deprecated` | Being retired. Do not build on it |

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

The Services page is the catalog. Each service's Settings page changes the
owner, contacts and lifecycle, and its Danger zone holds the delete.

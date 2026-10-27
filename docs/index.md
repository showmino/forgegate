---
sidebar_position: 0
---

# Forge

Forge is an internal developer platform for a GitHub organization. It makes
new services from templates, keeps the service catalog, runs previews, deploys to staging and
production, versions every release and records who did what.

You use it in two ways:

- **The `forge` CLI**, documented here, for everything.
- **The dashboard**, a web page for the same API at your Forge's address
  (`https://forge.example.com` in these pages). Every page in it shows the CLI
  command that does the same thing.

The examples use `my-org` for your GitHub organization and `example.com` for
your domains. Put your own in their place.

## Get Started

Each step needs the one before it:

1. **[Install Forge](01-running-your-own-forge.md)** on your Kubernetes
   cluster with Helm. This gives you the API, the dashboard and the login.
2. **[Install the CLI and log in](02-install-and-login.md)** once the API is
   live. Your Forge serves the CLI of its own version.
3. **[Write your templates](03-write-your-templates.md)**: a new Forge has
   none, and every service starts from one.
4. **[Create a service](04-create-a-service.md)** from a template. Its first
   push deploys it to staging.

New to Forge? Read [What is Forge](00-what-is-forge.md) first. If your
organization already runs a Forge, start at step 2.

## Pick What You Want to Do

| I want to... | Read |
| --- | --- |
| Move an app that already exists (Helm, a plain repo) to Forge | [Bring an existing repo](05-bring-an-existing-repo.md) |
| Know what goes in `forge.yaml` | [forge.yaml reference](06-forge-yaml.md) |
| Ship a change to staging, then production, or roll back | [Deploy and release](07-deploy-and-release.md) |
| Choose who can reach a service (internet or private network) | [Addresses and visibility](08-addresses.md) |
| Set replicas, resources, env vars, secrets, cron jobs | [Run options](09-run-options.md) |
| Try a branch in its own environment | [Preview environments](10-preview-environments.md) |
| Follow or stop long-running work | [Operations](11-operations.md) |
| Find a service, its owner, change or delete it | [The catalog](12-catalog.md) |
| Write docs for my service | [Service docs](13-service-docs.md) |
| Give my service a database | [Resources](14-resources.md) |
| See who changed what | [Audit log](15-audit-log.md) |
| Write or check a template | [Templates](16-templates.md) |
| Use Forge in scripts, or fix an error | [Scripting and troubleshooting](17-scripting-and-troubleshooting.md) |
| Look up a command and its flags | [Command reference](18-command-reference.md) |
| Look up a setting of the Helm chart | [Chart values](19-chart-values.md) |
| See how full the cluster is | [Cluster capacity](20-cluster-capacity.md) |

## How Forge Fits Together

```text
forge CLI ──┐
            ├──> Forge API ──> GitHub (repos, tags, releases)
dashboard ──┘        │
                     └──> forge-deploys (GitOps repo) ──> Argo CD ──> Kubernetes
```

- A service is a GitHub repo in your organization with a
  `forge.yaml` at its root, plus an entry in the catalog.
- Its CI builds an image (`ghcr.io/my-org/<service>:<sha>`) and deploys it
  to **staging** on every push to `main`.
- A person **promotes** staging to **production**. Forge then tags the commit
  as a release.
- Forge never runs `kubectl` against the cluster for you. It writes to the
  GitOps repo, and Argo CD applies the change.

## Who Can Do What

Every service belongs to a team of your GitHub organization (its
`team` in the catalog). Who may do what follows that team:

| | Every member | The service's team | Admins |
| --- | :---: | :---: | :---: |
| Read: the catalog, deploys, the audit log, docs | ✓ | ✓ | ✓ |
| Create a service for your own team | | ✓ | ✓ |
| Update the service; deploy to staging; promote; roll back | | ✓ | ✓ |
| Previews: create, extend, destroy | | ✓ | ✓ |
| Cancel the service's operations | | ✓ | ✓ |
| Resources: plan; apply in staging | | ✓ | ✓ |
| Delete a service; change its address or claim a domain | | | ✓ |
| Register an existing repo or point a service at another repo; create for another team; move to another team | | | ✓ |
| Apply resources in production | | | ✓ |

Admins are the members of the teams named in the chart's `github.adminTeams`,
by default `my-org:platform-engineering`.

You may also extend, destroy or cancel what you started yourself. A refusal
says which action it was and which team it needs, and exits 5.

- **A service's own CI** can deploy only that service, only to staging, and
  only from its default branch. It needs no secret (see
  [Deploy and release](07-deploy-and-release.md#from-ci)).

`forge auth status` shows your role (admin, or the teams you are in);
`forge auth can deploy.promote <service>` answers yes or no for one action;
`forge service get <service>` lists what you may do on that service.

The dashboard follows the same table. Its sidebar shows your role (**Admin**,
**Team** or **Reader**), and each page shows only the buttons you may use: a
reader sees no Deploy, Promote or Settings, a team member sees them on the
team's services only, and Delete, Change address and Change owner are for
admins. A button you do not see is one the API would refuse. After you move a
service to another team, the page shows the new team's actions at once.

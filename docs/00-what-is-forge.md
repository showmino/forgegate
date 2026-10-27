---
sidebar_position: 0.5
---

# What Is Forge

Forge is an internal developer platform for a GitHub organization: the one place where a service
is created, described, deployed, released and documented. You tell Forge
**what** your service needs in a short `forge.yaml`; the platform decides
**how** that runs on the cluster.

## Why It Exists

Before Forge, every app carried its own Helm values: probes, Istio and
gateway settings, autoscaling with a Prometheus address, 1Password item paths,
DNS zones. Each team had to know the cluster to ship a web page, every app
did it slightly differently, and a change to the platform meant editing every
repo.

Forge moves that knowledge into the platform:

- **One small file per service.** `forge.yaml` names the service, its port,
  its health check and the few run options it needs. The rest has safe
  defaults that the platform team maintains for everyone.
- **A paved road.** New services start from a template that already has CI,
  a Dockerfile, tests, docs and a forge.yaml that works. The first push
  deploys to staging.
- **The same safety for every service.** Containers run as non-root with a
  read-only file system, each environment has a quota, secrets come only from
  the vaults the platform allows, and production changes only through a person's
  promotion.
- **One answer to "what runs where?"** The catalog knows every service, its
  team and owners, what is deployed in each environment, which version it is
  and who put it there.

## The Words Forge Uses

| Word | Meaning |
| --- | --- |
| **Service** | A GitHub repo in your organization with a `forge.yaml` at its root, and its entry in the catalog |
| **Catalog** | The list of every service with its team, owners, lifecycle, dependencies and repo |
| **Template** | The starting point of a new service, from your organization's templates repo, or a file template that opens a pull request in another repo instead |
| **forge.yaml** | What the service is and needs: port, health check, address, run options, resources, docs |
| **Environment** | Where a service runs: **staging**, **production**, or a short-lived **preview** of a branch |
| **Deploy** | Put a commit's image into an environment. CI deploys `main` to staging on every push |
| **Promote** | Copy exactly what runs in staging to production. Only a person can do it |
| **Release** | The version Forge tags on the commit, with a GitHub release: a candidate (`v1.4.0-rc.1`) on each staging deploy, the final `v1.4.0` when it is promoted |
| **Rollback** | Put an earlier release back in production |
| **Who can reach it** | **Internal** (an address under the cluster's apps domain) by default; where the platform offers public domains, also **Public** or **Internal staging** |
| **Run options** | Replicas, CPU and memory, env vars, secrets, cron jobs, autoscaling |
| **Resources** | Infrastructure a service declares, such as a Postgres database. Only where the platform switched them on |
| **Operation** | Long-running work (a deploy, a promotion, a preview) you can watch or cancel |
| **Audit log** | One record per change anyone made through Forge, refused attempts included |
| **Service docs** | The Markdown in a service's `docs/` folder, shown in the dashboard |

## The Life of a Service

```text
forge create ──> repo + CI + catalog entry
      │
  push to main ──> CI builds the image ──> staging, tagged v1.0.1-rc.1
      │
  forge deploy promote ──> production, tagged v1.0.1
      │
  forge deploy rollback ──> an earlier release back in production
```

1. **Create.** `forge create` (or the dashboard's Create page) makes the repo
   from a template, registers it in the catalog and starts its CI. An app
   that already exists is registered instead
   ([Bring an existing repo](03-bring-an-existing-repo.md)).
2. **Build and deploy to staging.** Every push to `main` builds an image and
   deploys it to staging. CI needs no secret: Forge trusts the repo's own
   GitHub identity, for its own service and for staging only.
3. **Try a branch.** A preview environment runs any branch at its own
   address, and expires by itself.
4. **Promote.** When staging is good, a member of the service's team
   promotes it. Production gets the same image, and the commit gets its
   final version.
5. **Operate.** Status, history, the audit log and the docs are in the CLI
   and the dashboard. If a release is bad, roll back.

## The Parts

| Part | What it is |
| --- | --- |
| `forge` CLI | The command line, for people and for CI. Everything Forge does is here |
| Dashboard | The same API in a web page, at your Forge's address. Each page shows the matching CLI command |
| Forge API | The server both talk to. It holds the catalog and the audit log and does the work |
| `my-org/forge-templates` | Your templates, released by version tags |
| `my-org/forge-deploys` | The GitOps repo: what should run in each environment. Only Forge writes to it |
| Argo CD | Applies the GitOps repo to the cluster |
| Login | GitHub, through Dex. Every member of your organization can read; a service's team works on it; admins (by default the team `platform-engineering`) can change everything |

## What Forge Does Not Do

- **It does not build your code.** Your repo's CI (GitHub Actions) builds and
  tests; Forge deploys what it built.
- **It does not change the cluster directly.** It writes the GitOps repo and
  Argo CD applies it, so every change is a commit that can be read and undone.
- **It does not take Helm values.** A service has `forge.yaml` and nothing
  else; what is not in it is the platform's decision.
- **It does not hold your secrets.** They stay in your vault (1Password); forge.yaml only
  names the item and key.

Ready to start? [Install the CLI and log in](01-install-and-login.md).

---
sidebar_position: 2
---

# Install Forge

The first step: Forge for your own GitHub organization, on your own
Kubernetes cluster, installed from code. One Argo CD Application in your Git
repo says which version of Forge runs with which settings; Argo CD installs
it, and every change after that, an upgrade included, is a commit. The CLI comes after, from the
running Forge ([Install and log in](02-install-and-login.md)), and then your
templates and services.

You get the API, the dashboard and the login (Dex, signing in with GitHub),
all on one address: the dashboard at `/`, the API at `/forge.v1.*` and
`/cli/`, the login at `/dex`. Forge keeps its data in a PostgreSQL database
you run, outside Forge's own install: removing Forge never removes its data.

## What you need

- **A Kubernetes cluster** with an ingress controller (ingress-nginx,
  Traefik, ...) or a Gateway API implementation.
- **A DNS name** for Forge, for example `forge.example.com`, pointing at that
  ingress controller or Gateway, and a TLS certificate for it (cert-manager,
  or a certificate your controller already serves).
- **A GitHub organization** you own.
- **Argo CD 3.1 or later** in the namespace `argocd`, which installs Forge
  from its chart and later deploys your services.
- **A Git repo** for the cluster's configuration, which Argo CD reads.
- **A PostgreSQL server** for Forge's data: a managed one, or one in your
  cluster in another namespace (step 3 shows one with CloudNativePG).

For previews you also need a Gateway API implementation (see the end of this
page).

## 1. Make a GitHub App

In your organization: **Settings → Developer settings → GitHub Apps → New
GitHub App**.

- **Callback URL:** `https://forge.example.com/dex/callback`. The scheme and
  the host must match Forge's address exactly.
- **Permissions:**
  - Repository: Contents (read and write), Administration (read and write,
    for `forge create`), Workflows (read and write), Metadata (read).
  - Organization: **Members (read)**. Without it the login sees no teams and
    nobody is an admin.
- **Where can it be installed:** only this account.

Then on the App's page:

1. Note the **App ID** and the **Client ID**.
2. **Generate a new client secret** and keep it.
3. **Generate a private key** and keep the `.pem` file.
4. **Install App** on your organization, for all repositories (Forge creates
   new ones).

## 2. Make two repos

- **Your templates repo**, `<org>/forge-templates`: the templates
  `forge create` makes new services from. Start it from the example in
  [Your Templates](03-write-your-templates.md); [Templates](16-templates.md)
  has the format and `forge template lint`.
- **Your deploys repo**, `<org>/forge-deploys`, only if you turn on deploys:
  an empty repo with a `main` branch. Forge writes to it; nobody edits it by
  hand.

Set the organization variable **`FORGE_API_URL`** to
`https://forge.example.com` (Settings → Secrets and variables → Actions →
Variables). Your services' CI uses it to deploy through Forge. On GitHub
Free, private repositories cannot read organization variables; the example
template takes the address as a parameter instead.

## 3. Make Forge's Database

Forge requires a PostgreSQL database that you provision and manage
separately. Forge does not install or manage a PostgreSQL instance as part of
its core deployment.

Before installing Forge:

1. Provision a PostgreSQL database using your preferred managed database
   service or self-hosted PostgreSQL deployment.
2. Create the two databases Forge needs, `forge` for Forge and `dex` for its
   authentication service, Dex, and one database user that owns both.
3. Configure the database connection credentials using Kubernetes Secrets or
   your existing secrets-management solution (step 4).
4. Ensure the Forge namespace can reach the database over the network and
   that TLS is configured appropriately.

Configure Forge to use your external database through the chart's database
settings. Refer to [Chart Values](19-chart-values.md#database) for the
supported configuration fields and Secret format.

Forge does not provision database storage, manage database backups, or
provide database high availability. These responsibilities belong to your
database provider or database operator. Running the database outside Forge's
install also means that deleting Forge's namespace or Application leaves the
data where it is.

Before upgrading Forge, review the
[release notes](https://github.com/showmino/forge/releases) for any database
schema migrations or configuration changes.

With [CloudNativePG](https://cloudnative-pg.io) (the operator must be
installed), in a namespace `databases`: first the database user's password,

```sh
kubectl create namespace databases
password=$(openssl rand -hex 24)
kubectl -n databases create secret generic forge-db-credentials \
  --type=kubernetes.io/basic-auth \
  --from-literal=username=forge --from-literal=password="$password"
```

then the cluster and the login's database, in your repo with an Application
of their own (not Forge's):

```yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: forge-db
  namespace: databases
spec:
  instances: 2
  storage:
    size: 5Gi
  bootstrap:
    initdb:
      database: forge
      owner: forge
      secret:
        name: forge-db-credentials
---
apiVersion: postgresql.cnpg.io/v1
kind: Database
metadata:
  name: forge-db-dex
  namespace: databases
spec:
  name: dex
  owner: forge
  cluster:
    name: forge-db
```

Its address is `forge-db-rw.databases.svc`. CloudNativePG's
[Barman Cloud plugin](https://cloudnative-pg.io/plugin-barman-cloud/) backs it
up to object storage.

With a managed server, create the user `forge` and the databases `forge` and
`dex`, owned by it.

### What Forge Needs From It

Forge needs:

- **PostgreSQL 18.** It is the version Forge is tested with; older versions
  are not tested.
- **One user that owns both databases.** forge-api creates and changes its
  tables, and Dex its own; neither needs a superuser.
- **The network:** Forge's namespace reaches the server's port (5432 by
  default) from the pods `forge-api` and `dex`. The chart makes no egress
  NetworkPolicy; if your namespaces deny egress by default, allow this one.
- **TLS:** `sslmode=require` in `uri` and `database.sslMode: require` encrypt
  the connection (and check the certificate against `database.caSecret`'s CA
  when one is set). `verify-full` also checks the server's name: against
  the system's trusted roots (most managed servers), or against your own CA
  in a Secret with the key `ca.crt`, named by `database.caSecret`. For
  CloudNativePG, copy `ca.crt` (only that key: the Secret also holds the CA's
  private key) from its Secret `<cluster>-ca` into a Secret in Forge's
  namespace.
- **Connections:** forge-api keeps a small pool (at most 4 connections, or the
  number of CPUs if more); `pool_max_conns` in `uri` changes it. Behind
  PgBouncer, use session pooling: migrations hold a session lock.

forge-api migrates its database when it starts, one migration per
transaction, behind a lock so that two never run at once. Migrations only go
forward; nothing undoes them. Back the database up before an upgrade: going
back to an older Forge then means restoring the database from before it. Dex
migrates its own database the same way.

Back both databases up, from the same point in time. To recover, restore
them, then restart Forge (`kubectl -n forge rollout restart deploy/forge-api
deploy/dex`). Sign-ins made after the backup are lost; everyone else stays
signed in. High availability and monitoring are the database's too: Forge
waits about a minute for its database when it starts, then stops and
restarts.

## 4. Make the Secrets

Secrets do not go in Git, so you make them once, before Argo CD installs
Forge. The namespace, and the Secret with the GitHub App's credentials:

```sh
kubectl create namespace forge
kubectl -n forge create secret generic forge-github \
  --from-file=app-private-key=my-app.2026-10-25.private-key.pem \
  --from-literal=client-id=<the App's Client ID> \
  --from-literal=client-secret=<the client secret>
```

And how Forge reaches its database: the user's password (from step 3; with
a managed server, set `password` to the password you gave the user `forge`),
and the API's connection string with the same password (URL-escaped, if it
has characters such as `@ : / ? # %`):

```sh
kubectl -n forge create secret generic forge-database \
  --from-literal=password="$password" \
  --from-literal=uri="postgres://forge:$password@forge-db-rw.databases.svc:5432/forge?sslmode=require"
unset password
```

If your cluster gets its secrets from a secret manager (External Secrets,
Sealed Secrets, the 1Password operator), make the same two Secrets with it
instead, and they are in code too.

## 5. Install Forge from Your Repo

Add this file to the repo Argo CD reads, for example as
`apps/forge.yaml`, with your organization, App ID and address:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: forge
  namespace: argocd
spec:
  project: default
  source:
    repoURL: oci://ghcr.io/showmino/charts/forge
    targetRevision: 0.33.0         # Forge's version: the API, dashboard and deploy chart
    path: .
    helm:
      releaseName: forge
      valuesObject:
        github:
          org: my-org
          appID: "123456"
          adminTeams: my-org:platform-engineering
        host: forge.example.com
        ingress:
          className: nginx
          annotations:
            cert-manager.io/cluster-issuer: letsencrypt
            # The API streams operation logs; ingress-nginx cuts them at 60s.
            nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
          tls:
            secretName: forge-tls
        database:
          existingSecret: forge-database
          host: forge-db-rw.databases.svc
  destination:
    server: https://kubernetes.default.svc
    namespace: forge
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

- `valuesObject` holds the chart's values. [Chart Values](19-chart-values.md)
  lists every one, with complete examples to copy in.
- With a Gateway instead of an Ingress, set `ingress.enabled: false`,
  `gateway.enabled: true` and name your Gateway in `gateway.parentRefs`.
- Without cert-manager, put a certificate for the address in the Secret
  `forge-tls` yourself and leave out the annotation.

Commit and push it. If Argo CD already applies that repo's `apps/` (an
"app of apps"), it picks the file up by itself. Otherwise apply it once; from
then on Argo CD follows the chart and the values:

```sh
kubectl apply -f apps/forge.yaml
```

### Who is an admin

Everyone in the organization can sign in. Members of the teams in
`github.adminTeams` (default `<org>:platform-engineering`, comma separated)
are admins: they may do everything, for example promote to production. The
others change the services of their own teams.

## 6. Check It

```sh
kubectl -n argocd get application forge   # Synced, Healthy
kubectl -n forge get pods                 # dex, forge-api, forge-web: Running
```

The API answers, and the login serves its discovery document:

```sh
curl -fsS -X POST -H 'Content-Type: application/json' -d '{}' \
  https://forge.example.com/forge.v1.AuthService/GetServerInfo
curl -fsS https://forge.example.com/dex/.well-known/openid-configuration
```

Open `https://forge.example.com` and sign in with GitHub. Then install the
CLI from your new Forge ([Install and log in](02-install-and-login.md#install-the-cli)),
which serves the build of its own version, and log in:

```sh
forge context set mine --api https://forge.example.com --use
forge auth login
forge auth status
```

Someone outside your organization is refused at the login.

## Upgrade

Change `targetRevision` to the new version in your repo, commit and push.
Argo CD upgrades Forge: the API, the dashboard and the chart services are
deployed with move together. A setting changes the same way, in
`valuesObject`. To go back, revert the commit.

The [releases](https://github.com/showmino/forge/releases) list the
versions.

### From a chart before 0.32.0

Before 0.32.0 the chart could run the database itself, inside Forge's
install: `database.mode: bundled` (the default) or `cloudnativepg`. 0.32.0
refuses those values, or asks for `database.host` if you never set any, so
Argo CD stops at a `ComparisonError` and removes nothing until you change
them. The sync after that change deletes the old database's objects, so first:

1. Make a database outside Forge's install (step 3).
2. Copy the data: `pg_dump` the databases `forge` and `dex` from the old one,
   and `pg_restore --no-owner --role=forge` them into the new one.
3. Keep the old database: annotate its objects (the StatefulSet `forge-db`
   and the Secret `forge-db`, or the CloudNativePG `Cluster` `forge-db`, whose
   deletion also deletes its volumes) with
   `argocd.argoproj.io/sync-options: Prune=false,Delete=false`. Installed with
   the Helm CLI, annotate them `helm.sh/resource-policy=keep` instead.
4. Make the Secret `forge-database` (step 4), set `database.existingSecret`
   and `database.host`, change `targetRevision`, commit and push.
5. Once Forge works on the new database, delete the old one.

With `database.mode: external`, only the values move: `database.external.*`
becomes `database.*`, and `database.mode` goes.

## Try It Without Argo CD

To try Forge on a cluster without Argo CD, the same chart installs with the
Helm CLI. Then nothing records what runs, and deploys stay off until you add
Argo CD, so move to an Application before you rely on it.

Make the database (step 3) and the Secrets (step 4), put the `valuesObject`
from step 5 in `forge-values.yaml`, and:

```sh
helm install forge oci://ghcr.io/showmino/charts/forge --version 0.33.0 -n forge -f forge-values.yaml
helm test forge -n forge          # the API answers and the login is reachable
```

The chart is also in a classic Helm repo, for tools that do not read OCI
registries. It is the same package:

```sh
helm repo add forge https://forgegate.io/charts
helm repo update
helm search repo forge/forge --versions   # the versions there
helm install forge forge/forge --version 0.33.0 -n forge -f forge-values.yaml
```

In an Argo CD Application, that is `repoURL: https://forgegate.io/charts`
with `chart: forge` and `targetRevision: 0.33.0`, instead of the OCI
`repoURL` and `path`.

## Previews and deploys

Both are off by default. Their settings go in the Application's
`valuesObject`. Both need a domain whose wildcards you point at your
cluster, and a Secret that pulls your services' images:

```yaml
apps:
  domain: apps.example.com   # deploys at *.staging.apps.example.com and *.production.apps.example.com,
                             # previews at *.preview.apps.example.com
  pullSecret: registry       # a dockerconfigjson Secret in Forge's namespace
```

**Deploys** (`forge deploy`, staging and production) use the same Argo CD.
With only an ingress controller, each service gets an Ingress:

```yaml
apps:
  routing: ingress
  ingress:
    className: nginx
    annotations:
      cert-manager.io/cluster-issuer: letsencrypt
    tls: true                # a certificate per service, in <service>-tls
deploys:
  enabled: true
```

With a Gateway API implementation instead, leave `apps.routing: gateway` (the
default) and name your GatewayClass in `apps.gateway.className`; the chart
makes the Gateway `forge-previews`, and you point the wildcards at its
address.

The chart adds Argo CD's project and ApplicationSet. Argo CD pulls the
deploy chart from `oci://ghcr.io/showmino/forge-chart`, which is public: it
needs no credential. It reads your deploys repo through the GitHub App.
Forge shows a service's address as `http://` even when its Ingress serves
HTTPS.

**Previews** (`forge env create`) need `apps.routing: gateway`:

```yaml
previews:
  enabled: true
```

**Cluster capacity** (`forge cluster list`, admins): `clusters.enabled:
true`. It needs metrics-server.

## When something is wrong

| What you see | What it means |
| --- | --- |
| `forge-api` is not ready, its log says "waiting for OIDC issuer" | The API reaches the login through the public address: it must resolve inside the cluster and its certificate must be trusted |
| GitHub says "The redirect_uri is not associated with this application" | The App's callback URL is not exactly `https://<host>/dex/callback` |
| You sign in but nothing is allowed | The App lacks the organization permission Members (read), or you are not in `github.adminTeams` |
| The Application `forge` shows `ComparisonError` and cannot fetch the chart | Argo CD is older than 3.1 (it has no `oci://` sources), or it cannot reach `ghcr.io` |
| Pods wait with `CreateContainerConfigError` | A Secret from step 4 is missing or a key is named differently: `forge-github` (`app-private-key`, `client-id`, `client-secret`) or `forge-database` (`password`, `uri`) |
| `forge-api` or `dex` cannot log in to the database | The password in `forge-database` is not the database user's, or `uri` has it without URL-escaping |
| `dex` fails with `database "dex" does not exist` | Create the login's database (`database.loginDatabase`, default `dex`), owned by the same user |
| `forge-api` or `dex` fails with `certificate signed by unknown authority` | With `verify-full`, the server's CA is not a trusted root: put it in a Secret with the key `ca.crt` and name it in `database.caSecret` |
| `forge-api` keeps logging "waiting for the database", then restarts | It cannot reach the server: check `uri`'s host and port, and that Forge's namespace may connect to it |
| The Application `forge` shows `ComparisonError` with "database.… is gone" | Values of a chart before 0.32.0: see [From a chart before 0.32.0](#from-a-chart-before-0320) |
| `forge template list` fails or shows nothing | `<org>/forge-templates` (or `github.templatesRepo`) does not exist, has no release tag, or the App is not installed on it |

## Next

1. [Install the CLI and log in](02-install-and-login.md), from your Forge.
2. [Write your templates](03-write-your-templates.md): a new Forge has none.
3. [Create a service](04-create-a-service.md).

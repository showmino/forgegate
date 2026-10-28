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

You get the API, the dashboard, the login (Dex, signing in with GitHub) and a
database, all on one address: the dashboard at `/`, the API at
`/forge.v1.*` and `/cli/`, the login at `/dex`.

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

## 3. Make the Secrets

Secrets do not go in Git, so you make them once, before Argo CD installs
Forge. The namespace, and the Secret with the GitHub App's credentials:

```sh
kubectl create namespace forge
kubectl -n forge create secret generic forge-github \
  --from-file=app-private-key=my-app.2026-10-25.private-key.pem \
  --from-literal=client-id=<the App's Client ID> \
  --from-literal=client-secret=<the client secret>
```

And the password of Forge's database. Argo CD renders the chart without
reading the cluster, so the chart cannot keep a password it made itself; you
make it instead:

```sh
password=$(openssl rand -hex 24)
kubectl -n forge create secret generic forge-db \
  --from-literal=password="$password" \
  --from-literal=uri="postgres://forge:$password@forge-db.forge.svc:5432/forge?sslmode=disable"
unset password
```

If your cluster gets its secrets from a secret manager (External Secrets,
Sealed Secrets, the 1Password operator), make the same two Secrets with it
instead, and they are in code too.

## 4. Install Forge from Your Repo

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
    targetRevision: 0.30.0         # Forge's version: the API, dashboard and deploy chart
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
          bundled:
            existingSecret: forge-db
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

### The database

The default is one PostgreSQL pod with a 5 GiB volume, using the Secret
`forge-db` you made above. Deleting the Application keeps the volume. It has
**no backups**. For data you can't lose:

- `database.mode: external`: your own PostgreSQL. Create a Secret with `uri`
  (the connection string) and `password`, create a second database `dex` on
  the same server for the login, and set `database.external.existingSecret`
  and `database.external.host`.
- `database.mode: cloudnativepg`: a CloudNativePG cluster (the operator must
  be installed), with backups through its plugins
  (`database.cloudnativepg.plugins`). It makes its own password, so the
  Secret `forge-db` is not needed.

## 5. Check It

```sh
kubectl -n argocd get application forge   # Synced, Healthy
kubectl -n forge get pods                 # dex, forge-api, forge-db-0, forge-web: Running
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

## Try It Without Argo CD

To try Forge on a cluster without Argo CD, the same chart installs with the
Helm CLI. Then nothing records what runs, and deploys stay off until you add
Argo CD, so move to an Application before you rely on it.

Make the Secret `forge-github` as in step 3 (the chart makes `forge-db`
itself here), put the `valuesObject` from step 4 in `forge-values.yaml`
without the `database` part, and:

```sh
helm install forge oci://ghcr.io/showmino/charts/forge --version 0.30.0 -n forge -f forge-values.yaml
helm test forge -n forge          # the API answers and the login is reachable
```

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
| Pods wait with `CreateContainerConfigError` | A Secret from step 3 is missing or a key is named differently: `forge-github` (`app-private-key`, `client-id`, `client-secret`) or `forge-db` (`password`, `uri`) |
| `forge-api` or `dex` cannot log in to the database | The password in `forge-db` changed after the database was first made; the database keeps the first one |
| `forge template list` fails or shows nothing | `<org>/forge-templates` (or `github.templatesRepo`) does not exist, has no release tag, or the App is not installed on it |

## Next

1. [Install the CLI and log in](02-install-and-login.md), from your Forge.
2. [Write your templates](03-write-your-templates.md): a new Forge has none.
3. [Create a service](04-create-a-service.md).

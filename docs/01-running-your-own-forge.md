---
sidebar_position: 2
---

# Install Forge

The first step: Forge for your own GitHub organization, on your own
Kubernetes cluster, with one `helm install`. The CLI comes after, from the
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
- **Helm 3.8 or later.**

For deploys you also need Argo CD; for previews, a Gateway API
implementation. Both are optional (see the end of this page).

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

## 3. Install

Make the namespace and the one Secret Forge needs, from the GitHub App:

```sh
kubectl create namespace forge
kubectl -n forge create secret generic forge-github \
  --from-file=app-private-key=my-app.2026-10-25.private-key.pem \
  --from-literal=client-id=<the App's Client ID> \
  --from-literal=client-secret=<the client secret>
```

Then install the chart:

```sh
helm install forge oci://ghcr.io/showmino/charts/forge -n forge \
  --set github.org=<org> \
  --set github.appID=<App ID> \
  --set host=forge.example.com \
  --set ingress.className=nginx \
  --set ingress.tls.secretName=forge-tls
```

- With cert-manager, add
  `--set ingress.annotations.cert-manager\.io/cluster-issuer=<issuer>` and it
  fills `forge-tls`.
- With a Gateway instead of an Ingress:
  `--set ingress.enabled=false --set gateway.enabled=true` and name your
  Gateway in `gateway.parentRefs` (a values file is easier, see below).
- The API streams operation logs. With ingress-nginx, raise its read timeout:
  `--set ingress.annotations.nginx\.ingress\.kubernetes\.io/proxy-read-timeout=3600`.

For more than a few settings, use a values file:

```yaml
# forge-values.yaml
github:
  org: my-org
  appID: "123456"
  adminTeams: my-org:platform-engineering
host: forge.example.com
ingress:
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt
  tls:
    secretName: forge-tls
```

```sh
helm install forge oci://ghcr.io/showmino/charts/forge -n forge -f forge-values.yaml
```

[Chart Values](19-chart-values.md) lists every setting with its default, and
has complete values files for an Ingress, a Gateway with previews and deploys,
and your own PostgreSQL. `helm show values oci://ghcr.io/showmino/charts/forge`
prints the defaults with their comments.

### Who is an admin

Everyone in the organization can sign in. Members of the teams in
`github.adminTeams` (default `<org>:platform-engineering`, comma separated)
are admins: they may do everything, for example promote to production. The
others change the services of their own teams.

### The database

By default the chart runs one PostgreSQL pod with a 5 GiB volume and makes
its password once, into the Secret `forge-db`. `helm uninstall` keeps the
Secret and the volume. It has **no backups**. For data you can't lose:

- `database.mode: external`: your own PostgreSQL. Create a Secret with `uri`
  (the connection string) and `password`, create a second database `dex` on
  the same server for the login, and set `database.external.existingSecret`
  and `database.external.host`.
- `database.mode: cloudnativepg`: a CloudNativePG cluster (the operator must
  be installed), with backups through its plugins
  (`database.cloudnativepg.plugins`).

If you install with Argo CD or `helm template` instead of `helm install`, set
`database.bundled.existingSecret` to a Secret of your own: those tools cannot
read the generated password back and would make a new one on every sync.

## 4. Check it

```sh
kubectl -n forge get pods          # dex, forge-api, forge-db-0, forge-web: Running
helm test forge -n forge           # the API answers and the login is reachable
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

```sh
helm upgrade forge oci://ghcr.io/showmino/charts/forge -n forge -f forge-values.yaml
```

The chart's version is Forge's version: it picks the API, the dashboard and
the chart services are deployed with, together. Add `--version X.Y.Z` to
choose one.

## Previews and deploys

Both are off by default. Both need a domain whose wildcards you point at
your cluster, and a Secret that pulls your services' images:

```yaml
apps:
  domain: apps.example.com   # deploys at *.staging.apps.example.com and *.production.apps.example.com,
                             # previews at *.preview.apps.example.com
  pullSecret: registry       # a dockerconfigjson Secret in Forge's namespace
```

**Deploys** (`forge deploy`, staging and production) need Argo CD in the
namespace `argocd`. With only an ingress controller, each service gets an
Ingress:

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
| Pods wait with `CreateContainerConfigError` | The Secret `forge-github` is missing or a key is named differently (`app-private-key`, `client-id`, `client-secret`) |
| `forge template list` fails or shows nothing | `<org>/forge-templates` (or `github.templatesRepo`) does not exist, has no release tag, or the App is not installed on it |

## Next

1. [Install the CLI and log in](02-install-and-login.md), from your Forge.
2. [Write your templates](03-write-your-templates.md): a new Forge has none.
3. [Create a service](04-create-a-service.md).

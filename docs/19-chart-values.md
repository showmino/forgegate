---
sidebar_position: 20
---

# Chart Values

Every setting of the chart `oci://ghcr.io/showmino/charts/forge`, as of
version `0.32.0`. [Install Forge](01-running-your-own-forge.md) walks through
an install; this page is the reference. Your settings go under
`spec.source.helm.valuesObject` in Forge's Argo CD Application, in your Git
repo; a change is a commit. They hold only what differs from the defaults,
and the examples below are complete sets you can copy in. With the Helm CLI
instead, the same keys go in a values file (`-f forge-values.yaml`).

```sh
helm show values oci://ghcr.io/showmino/charts/forge --version 0.32.0   # the defaults, with comments
```

## Required

| Value | What |
| --- | --- |
| `github.org` | Your GitHub organization |
| `github.appID` | Your GitHub App's numeric ID, quoted (`"123456"`) |
| `host` | The address Forge is reached at, without a scheme |
| The Secret `github.existingSecret` | Created by you before the install (see [GitHub](#github)) |
| `ingress.className` or `gateway.parentRefs` | How the address reaches Forge (see [Address](#address)) |
| `database.existingSecret` and `database.host` | Forge's PostgreSQL, which you run outside Forge's install (see [Database](#database)) |

With previews or deploys on, `apps.domain` and `apps.pullSecret` are required
too. The chart refuses to render without them and says which one is missing.

## Examples

### Ingress, cert-manager, your database

The smallest production-like install: one address with TLS, no previews or
deploys yet.

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
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
  tls:
    secretName: forge-tls
database:
  existingSecret: forge-database
  host: forge-db-rw.databases.svc
```

### Gateway, previews and deploys

```yaml
# forge-values.yaml
github:
  org: my-org
  appID: "123456"
host: forge.example.com
ingress:
  enabled: false
gateway:
  enabled: true
  parentRefs:
    - {name: public, namespace: gateway-system}
database:
  existingSecret: forge-database
  host: forge-db-rw.databases.svc
argocdURL: https://argocd.example.com
apps:
  domain: apps.example.com
  pullSecret: registry
  routing: gateway
  gateway:
    className: envoy
previews:
  enabled: true
deploys:
  enabled: true
clusters:
  enabled: true
  name: production
```

### A managed PostgreSQL, deploys over an Ingress, images on another registry

```yaml
# forge-values.yaml
github:
  org: my-org
  appID: "123456"
  templatesRepo: my-org/platform-templates
host: forge.example.com
ingress:
  className: nginx
  tls:
    secretName: forge-tls
database:
  existingSecret: forge-database
  host: my-server.postgres.database.azure.com
imageRegistry: myregistry.azurecr.io
apps:
  domain: apps.example.com
  pullSecret: acr-pull
  routing: ingress
  ingress:
    className: nginx
    annotations:
      cert-manager.io/cluster-issuer: letsencrypt
    tls: true
deploys:
  enabled: true
```

## GitHub

| Value | Default | What |
| --- | --- | --- |
| `github.org` | (required) | Your GitHub organization. Only its members can sign in |
| `github.appID` | (required) | Your GitHub App's numeric ID |
| `github.existingSecret` | `forge-github` | A Secret in the release's namespace with three keys: `app-private-key` (the App's `.pem`), `client-id` and `client-secret` (the login uses them) |
| `github.keys.appPrivateKey`, `github.keys.clientID`, `github.keys.clientSecret` | `app-private-key`, `client-id`, `client-secret` | The key names in that Secret, when yours are named otherwise (for example by a secrets operator that keeps a vault's field names) |
| `github.adminTeams` | `<org>:platform-engineering` | The teams whose members are admins, comma separated, as `<org>:<team-slug>`. Everyone else who signs in can read, and change the services of their own teams |
| `github.templatesRepo` | `<org>/forge-templates` | The repo `forge create` scaffolds from (`owner/name`). See [Your Templates](03-write-your-templates.md) |

The App needs the organization permission Members (read), or the login sees
no teams and nobody is an admin.

## Address

Forge is one address: the dashboard at `/`, the API at `/forge.v1.*` and
`/cli/`, the login at `/dex`. Choose an Ingress or a Gateway, not both.

| Value | Default | What |
| --- | --- | --- |
| `host` | (required) | The address, without a scheme. The GitHub App's callback URL must be `https://<host>/dex/callback` |
| `https` | `true` | `false` serves `http://<host>`: only for a first try on a cluster without TLS. Sign-in tokens then travel unencrypted |
| `ingress.enabled` | `true` | Expose Forge through an Ingress (any controller) |
| `ingress.className` | `""` | The IngressClass. Empty is the cluster's default class |
| `ingress.annotations` | `{}` | Annotations on the Ingress, for example cert-manager's `cert-manager.io/cluster-issuer` |
| `ingress.tls.secretName` | `""` | The Secret with the certificate, which you or cert-manager fill. Empty uses the controller's default certificate |
| `gateway.enabled` | `false` | Expose Forge through HTTPRoutes on a Gateway of yours instead (set `ingress.enabled: false`). TLS is the Gateway listener's |
| `gateway.parentRefs` | `[]` | The Gateway to attach to, for example `[{name: my-gateway, namespace: gateway-system}]`. Required with `gateway.enabled`, unless `gateway.appsGateway` |
| `gateway.appsGateway` | `false` | `true` attaches the routes to the chart's own Gateway `forge-previews` (previews, or deploys with `apps.routing: gateway`), which then gets a listener for each of Forge's hosts. Send the host to that Gateway, as your services' addresses |

The API streams operation logs: raise your controller's read timeout (for
ingress-nginx, the annotation `nginx.ingress.kubernetes.io/proxy-read-timeout:
"3600"`). The dashboard's server and the API reach the login and the API
through this public address too, so it must resolve inside the cluster and its
certificate must be trusted there.

## API

| Value | Default | What |
| --- | --- | --- |
| `api.image.repository` | `ghcr.io/showmino/forge-api` | The API's image |
| `api.image.tag` | `""` | Empty is `v<appVersion>`, the API this chart was released with. Leave it empty: the chart and the API are released together |
| `api.host` | `""` | A host of its own for the API (optional). The dashboard then calls it across origins, which the chart allows |
| `api.service.type` | `ClusterIP` | `LoadBalancer` gives the API an address of its own as well, beside the routes, for example a fixed IP an older API name still points at |
| `api.service.annotations` | `{}` | Annotations on the API's Service, for example MetalLB's `metallb.universe.tf/loadBalancerIPs` |
| `api.resources` | requests `cpu: 10m`, `memory: 32Mi`; limits `memory: 256Mi` | The API's resources. Template releases are cached in memory, up to 100 MiB each |

## Dashboard

| Value | Default | What |
| --- | --- | --- |
| `web.enabled` | `true` | Run the dashboard. `false` leaves only the API, the CLI and the login, or a dashboard of your own named in `web.origins` |
| `web.origins` | `[]` | Addresses of dashboards that run elsewhere, for example the dashboard deployed as a Forge service in staging and production: `[https://forge.example.com, https://forge-staging.example.com]`. Each may sign in (`<origin>/auth/callback` is allowed) and call the API from a browser. Lower case, `https://host`, no path |
| `web.image.repository` | `ghcr.io/showmino/forge-web` | The dashboard's image |
| `web.image.tag` | `v0.1.34` (in `0.32.0`) | The dashboard has versions of its own; each chart release pins one |
| `web.replicas` | `1` | Dashboard pods |
| `web.resources` | requests `cpu: 10m`, `memory: 96Mi`; limits `memory: 384Mi` | The dashboard's resources |

## Login

| Value | Default | What |
| --- | --- | --- |
| `login.image` | `ghcr.io/dexidp/dex:v2.41.1` | The login (Dex) image |
| `login.host` | `""` | A host of its own for the login (optional). The GitHub App's callback URL is then `https://<login.host>/dex/callback` |
| `login.theme` | `true` | Dex's pages in Forge's look. `false` keeps Dex's own |
| `login.existingSecret` | `""` | A Secret of its own for the login's GitHub client, with the keys `github.keys.clientID` and `github.keys.clientSecret`. Empty uses `github.existingSecret` |

## Database

Forge keeps its data in a PostgreSQL server you run, outside Forge's install
(another namespace with its own Application, or a managed server), so that
removing Forge never removes its data. The chart runs no database. It needs
two databases on that server owned by one user: the API's (named in `uri`)
and the login's (`database.loginDatabase`). [Install Forge](01-running-your-own-forge.md#3-make-forges-database)
shows one with CloudNativePG, and [what Forge needs from it](01-running-your-own-forge.md#what-forge-needs-from-it): the version, permissions, network, TLS and backups.

| Value | Default | What |
| --- | --- | --- |
| `database.existingSecret` | `""` | **Required**: a Secret in Forge's namespace with `uri` (the API's connection string, for example `postgres://forge:<password>@db.example.com:5432/forge?sslmode=require`, the password URL-escaped) and `password` (the same password; the login needs it on its own) |
| `database.host` | `""` | **Required**: the server, for the login |
| `database.port` | `5432` | The server's port |
| `database.user` | `forge` | The user, who also owns the login's database |
| `database.loginDatabase` | `dex` | The login keeps its sessions in this second database on the same server. Create it before the install |
| `database.sslMode` | `require` | The login's `sslmode`: `disable`, `require` (encrypted; the certificate is checked only against `database.caSecret`'s CA when that is set), `verify-ca` or `verify-full`. The API takes its own from `uri`; use the same. With `database.caSecret`, a `uri` without `sslmode` gets this one |
| `database.caSecret` | `""` | A Secret with `ca.crt`, the CA of the server's certificate, for `verify-ca` and `verify-full` when the system's trusted roots don't cover it (a private CA). Mounted for the API (`PGSSLROOTCERT`) and the login |

Before 0.32.0 the chart could run the database itself (`database.mode`,
`database.bundled`, `database.cloudnativepg`) and had these values under
`database.external`. 0.32.0 refuses the old values; [From a chart before
0.32.0](01-running-your-own-forge.md#from-a-chart-before-0320) says how to move.

## Services: Previews and Deploys

Both are off by default. Both need `apps.domain` and `apps.pullSecret`.

| Value | Default | What |
| --- | --- | --- |
| `imageRegistry` | `""` (ghcr.io) | Where your services' CI pushes images: a host and an optional path, no scheme. Forge runs `<imageRegistry>/<owner>/<service>:<commit>` |
| `apps.domain` | `""` | A domain you control. Previews are at `*.preview.<domain>`, deploys at `*.staging.<domain>` and `*.production.<domain>`: point those names at your Gateway or ingress controller |
| `apps.pullSecret` | `""` | A `dockerconfigjson` Secret in the release's namespace that can pull your services' images. Forge checks that an image exists with it and copies it into each service's namespace |
| `apps.routing` | `gateway` | `gateway`: the chart makes the Gateway `forge-previews` (needs a Gateway API implementation). `ingress`: each deploy gets an Ingress, so an ingress controller is enough; previews need `gateway` |
| `apps.gateway.className` | `istio` | The name of an existing GatewayClass (`envoy`, `istio`, ...) |
| `apps.gateway.annotations` | `{}` | Annotations for the Service your Gateway implementation makes, for example a cloud's fixed public IP |
| `apps.ingress.className` | `""` | The IngressClass of each deploy's Ingress |
| `apps.ingress.annotations` | `{}` | Annotations on each deploy's Ingress, for example cert-manager's. They must not contain `{{` |
| `apps.ingress.tls` | `false` | `true` asks for a certificate per service in the Secret `<service>-tls` (with cert-manager's annotation). Forge still shows the address as `http://` |
| `previews.enabled` | `false` | `forge env create`: a preview of a branch in a namespace of its own. Needs `apps.routing: gateway` |
| `deploys.enabled` | `false` | `forge deploy`: Forge writes to your deploys repo and Argo CD deploys from it. Needs Argo CD in the namespace `argocd` |
| `deploys.repo` | `<org>/forge-deploys` | An empty repo with a `main` branch that the GitHub App can write to |
| `deploys.chart` | `oci://ghcr.io/showmino/forge-chart` | The chart services are deployed with; it is public |
| `deploys.chartRevision` | `""` | Empty is this chart's `appVersion`. Changing it redeploys every service |
| `deploys.excludedNamespaces` | `[]` | Existing namespaces named like `*-staging` or `*-production` that are not Forge's: Argo CD never deploys a service into them |
| `apps.publicDomains` | `[]` | Public addresses: domains a service may take its address under (`forge create --domain`, `run.domain` in `forge.yaml`), as `[{domain: example.com, zone: example-com}]`. The first is the default. The chart's Gateway gets a listener for each domain and its root; send the domains' hosts to it. With each such deploy Forge writes a DNS record (a kro `CloudflareRecordsApplication`) in the zone named by `zone`. Needs deploys and `apps.routing: gateway` |
| `apps.dnsTunnel` | `production` | The tunnel those DNS records point at |
| `argocdURL` | `""` | Argo CD's web address, to link a deployment to its Application (optional) |

With `apps.routing: ingress`, Argo CD waits for the controller to publish an
address on each Ingress. A controller that never does makes every deploy wait
for its sync timeout.

## Resources

`forge resource` plans and applies a service's databases: CloudNativePG
clusters (the operator must be installed), made by OpenTofu Jobs in the
namespace `<release namespace>-runner`. Needs deploys. See
[Resources](14-resources.md).

| Value | Default | What |
| --- | --- | --- |
| `resources.enabled` | `false` | Turn it on |
| `resources.runner.image.repository` | `ghcr.io/showmino/forge-runner` | The runner Jobs' image |
| `resources.runner.image.tag` | `""` | Empty is `v<appVersion>` |

## Service Secrets

`run.secrets` in a service's `forge.yaml` is off until `secrets.vaults`
names the groups services may read.

| Value | Default | What |
| --- | --- | --- |
| `secrets.backend` | `onepassword` | With `onepassword` (the 1Password operator must be installed) a group is a vault and an item is `vaults/<vault>/items/<item>` |
| `secrets.vaults` | `""` | The vaults services may read, comma separated. Empty turns `run.secrets` off |
| `secrets.deniedItems` | `""` | Items in those vaults no service may read (the platform's own credentials) |

## Cluster Capacity

`forge cluster list` and `forge cluster get` (admins) show this cluster's
nodes, CPU and memory. They need metrics-server.

| Value | Default | What |
| --- | --- | --- |
| `clusters.enabled` | `false` | Turn it on |
| `clusters.name` | `default` | The name Forge shows for this cluster |
| `clusters.prometheusURL` | `""` | Optional: a Prometheus inside the cluster (adds disk and volumes), for example `http://prometheus.monitoring.svc:9090` |
| `clusters.grafanaURL` | `""` | Optional: a Grafana to link to |
| `clusters.remote` | `[]` | Other clusters services may deploy to: the names of Argo CD's cluster Secrets in the namespace `argocd`. Forge reads exactly those |

## CLI Downloads

| Value | Default | What |
| --- | --- | --- |
| `cliRepo` | `showmino/forge` | The GitHub releases that `forge upgrade` and `/cli/releases/` download the CLI from (`owner/name`). The Linux builds at `/cli/forge-linux-<arch>` are in the API's image |

## When the Chart Refuses

The chart stops before changing anything when a value is wrong. Argo CD
shows the message on the Application `forge` (`ComparisonError`); `helm
install` and `helm upgrade` print it:

| Message | Fix |
| --- | --- |
| `github.org is required`, `github.appID is required`, `host is required` | Set them |
| `set either ingress.enabled or gateway.enabled, not both` | With a Gateway, also set `ingress.enabled: false` |
| `gateway.parentRefs is required with gateway.enabled` | Name your Gateway |
| `apps.domain is required with previews or deploys` | Set `apps.domain` |
| `apps.pullSecret is required with previews or deploys` | Create the pull Secret and name it |
| `previews.enabled needs apps.routing gateway` | Previews need a Gateway; turn them off or use `apps.routing: gateway` |
| `previews.<name> moved to apps.*` | A values file from before `0.28.0`: move them under `apps` (`gatewayDomain` is `apps.domain`, `gatewayClass` is `apps.gateway.className`, `gatewayAnnotations` is `apps.gateway.annotations`) |
| `database.external.existingSecret is required with database.mode external` (or `host`) | Set both for your own server |
| `resources.enabled needs deploys.enabled` | A database belongs to a deployed service: turn deploys on |
| `apps.publicDomains needs deploys.enabled` (or `apps.routing gateway`) | Public addresses are listeners on the chart's Gateway, for deploys |
| `apps.publicDomains: ... is not a domain`, `the zone of ... must be a name` | Lower case, like `{domain: example.com, zone: example-com}`; a zone cannot end in `-root` |
| `gateway.appsGateway needs the chart's Gateway` | Turn on previews, or deploys with `apps.routing: gateway` |
| `deploys.excludedNamespaces: ... is not a namespace name` | Lower case, like `docs-staging` |
| `clusters.remote needs clusters.enabled` | Turn on `clusters.enabled` |
| `apps.ingress.annotations must not contain {{` | Argo CD's ApplicationSet would read it as a template; remove it |
| `web.origins: "..." is not an origin such as https://forge.example.com` | Write the address as a browser sends it: `https://` and the host in lower case, no path or trailing slash |
| `web.origins: "...": leave out the port 80 or 443` | Remove the port: a browser leaves the scheme's own port out |

## All Defaults

The chart's `values.yaml` at `0.32.0`, with its comments. `helm show values`
prints the same settings.

```yaml
# Forge for your GitHub organization. Required: github.org, github.appID,
# the Secret github.existingSecret, and host. Everything else has a default.
# The walkthrough is "Install Forge" at https://forgegate.io/docs/running-your-own-forge.

github:
  # Your GitHub organization. Only its members can sign in.
  org: ""
  # Your GitHub App's numeric ID.
  appID: ""
  # A Secret you create in the release's namespace, with three keys:
  #   app-private-key  the GitHub App's private key (.pem)
  #   client-id        the GitHub App's client ID (the login uses it)
  #   client-secret    a client secret of the GitHub App
  # The App needs the organization permission Members: read, or the login
  # sees no teams and nobody is an admin.
  existingSecret: forge-github
  # The key names in that Secret, if yours are named otherwise (for example
  # by a secrets operator that keeps a vault's field names).
  keys:
    appPrivateKey: app-private-key
    clientID: client-id
    clientSecret: client-secret
  # The GitHub teams whose members are admins, comma separated, as
  # "<org>:<team-slug>". Defaults to "<org>:platform-engineering". Everyone
  # else who signs in can read, and change the services of their own teams.
  adminTeams: ""
  # Your templates repo (owner/name), which `forge create` scaffolds from.
  # Defaults to "<org>/forge-templates".
  templatesRepo: ""

# The one address of Forge, without a scheme: the dashboard at /, the API at
# /forge.v1.* and /cli/, the login at /dex. Point its DNS name at your
# ingress controller or Gateway. The GitHub App's callback URL must be
# https://<host>/dex/callback.
host: ""
# false serves http://<host>: only for a first try on a cluster without TLS.
# The CLI's and the browser's sign-in send tokens over it.
https: true

# Exposure through an Ingress (any controller). TLS comes from tls.secretName,
# which you or cert-manager fill (put cert-manager's annotation in
# annotations); empty uses the controller's default certificate. The API
# streams operation logs: raise the controller's read timeout, for
# ingress-nginx nginx.ingress.kubernetes.io/proxy-read-timeout: "3600".
# The dashboard's server and the API reach the login and the API through
# this public address too, so it must resolve and be trusted inside the
# cluster.
ingress:
  enabled: true
  className: ""
  annotations: {}
  tls:
    secretName: ""

# Or through HTTPRoutes on a Gateway of yours (set ingress.enabled false).
# TLS is the Gateway's listener's.
gateway:
  enabled: false
  # For example: [{name: my-gateway, namespace: gateway-system}]
  parentRefs: []
  # true: the routes attach to this chart's own Gateway forge-previews
  # (apps.routing gateway, with previews or deploys on), which then gets a
  # listener of its own for each of Forge's hosts; parentRefs is not needed.
  appsGateway: false

api:
  image:
    repository: ghcr.io/showmino/forge-api
    # Empty: v<appVersion>, the API this chart was released with.
    tag: ""
  # A host of its own for the API (optional; the dashboard then calls it
  # across origins, which the chart allows).
  host: ""
  # The API's Service. LoadBalancer gives the API an address of its own too,
  # beside the routes above, for example a fixed IP that an older API name
  # still points at (MetalLB: metallb.universe.tf/loadBalancerIPs).
  service:
    type: ClusterIP
    annotations: {}
  resources:
    requests: {cpu: 10m, memory: 32Mi}
    # Template releases are cached in memory (up to 100 MiB each).
    limits: {memory: 256Mi}

web:
  # The dashboard, on host. Turn it off when the dashboard runs elsewhere,
  # for example as a Forge service, and name its addresses in origins.
  enabled: true
  # Addresses of other dashboards that sign in to Forge and call its API
  # from a browser, such as a forge-web service in staging and production:
  # https://host, no path. Each becomes a Dex redirect URI
  # (<origin>/auth/callback), an allowed origin of Dex and of the API.
  origins: []
  image:
    repository: ghcr.io/showmino/forge-web
    tag: v0.1.34
  replicas: 1
  resources:
    requests: {cpu: 10m, memory: 96Mi}
    limits: {memory: 384Mi}

login:
  image: ghcr.io/dexidp/dex:v2.41.1
  # A host of its own for the login (optional). The GitHub App's callback URL
  # is then https://<login.host>/dex/callback.
  host: ""
  # Dex's pages in Forge's look (files/dex-theme). false keeps Dex's own.
  theme: true
  # A Secret of its own for the login's GitHub client, with the keys
  # github.keys.clientID and clientSecret. Empty: github.existingSecret.
  existingSecret: ""

# Forge's PostgreSQL, which you run: the chart runs no database of its own.
# Keep it outside Forge's namespace and its Argo CD Application (another
# namespace, a CloudNativePG Cluster of its own Application, or a managed
# server), so that removing Forge never removes its data, and back it up.
# Two databases on it, owned by one user: one for the API (named in "uri")
# and loginDatabase for the login's sessions. Create both first.
database:
  # A Secret in Forge's namespace with "uri" (the API's connection string,
  # for example postgres://forge:<password>@db.example.com:5432/forge?sslmode=require,
  # the password URL-escaped) and "password" (the same password: the login
  # needs it on its own).
  existingSecret: ""
  # The server, for the login (the API reads "uri").
  host: ""
  port: 5432
  user: forge
  loginDatabase: dex
  # The login's sslmode: disable, require (encrypted; the certificate is
  # checked only against caSecret's CA when that is set), verify-ca or
  # verify-full (checked against caSecret's CA, or the system's trusted roots
  # without it). The API takes its sslmode from "uri"; use the same. With
  # caSecret, a uri without sslmode gets this one.
  sslMode: require
  # A Secret in Forge's namespace with "ca.crt": the CA that signed the
  # server's certificate, when the system's roots don't (a private CA, such
  # as CloudNativePG's own). The API gets it as PGSSLROOTCERT, the login as its
  # caFile.
  caSecret: ""

# Where your services' CI pushes their images: a registry host and an
# optional path, no scheme. Deploys and previews run
# <imageRegistry>/<owner>/<service>:<commit>. Empty is ghcr.io.
imageRegistry: ""

# Argo CD's web address, to link a deployment to its Application. Optional.
argocdURL: ""

# Where `forge upgrade` downloads the CLI from (GitHub releases, owner/name).
cliRepo: showmino/forge

# run.secrets in a service's forge.yaml: off until vaults names the groups
# services may read. With the backend "onepassword" (the 1Password operator
# must be installed) a group is a vault and an item is
# vaults/<vault>/items/<item>; deniedItems are the items in those vaults no
# service may read (the platform's own credentials).
secrets:
  backend: onepassword
  vaults: ""
  deniedItems: ""

# Where your services run, for previews and deploys.
apps:
  # A domain you control. Previews are at *.preview.<domain>, deploys at
  # *.staging.<domain> and *.production.<domain>: point those names at your
  # Gateway or ingress controller.
  domain: ""
  # A dockerconfigjson Secret in the release's namespace that pulls your
  # services' images. Forge checks an image exists with it and copies it into
  # each service's namespace.
  pullSecret: ""
  # "gateway": the chart makes the Gateway forge-previews (needs a Gateway API
  # implementation). "ingress": deploys get an Ingress each, so an ingress
  # controller is enough; previews need "gateway".
  routing: gateway
  gateway:
    # The name of an existing GatewayClass.
    className: istio
    # Annotations for the Service your Gateway implementation creates, for
    # example a cloud's fixed public IP.
    annotations: {}
  ingress:
    className: ""
    annotations: {}
    # Ask for a certificate per service in the Secret <service>-tls (with
    # cert-manager's annotation above), or leave false for your controller's
    # default certificate. Forge still shows the address as http://.
    tls: false
    # Argo CD waits for the controller to publish an address on each
    # Ingress (status.loadBalancer); a controller that never does makes
    # every deploy wait for its sync timeout.
  # Public addresses: a service may set its address under one of these
  # domains (`forge create --domain`, run.domain in forge.yaml). Each is
  # {domain, zone}: zone names the DNS zone for the DNS record Forge writes
  # with each such deployment (a kro CloudflareRecordsApplication). The
  # chart's Gateway gets a listener per domain and its root. Needs deploys and
  # apps.routing gateway; send the domains' hosts to the Gateway (a tunnel or
  # DNS). The first domain is the default.
  publicDomains: []
  # The tunnel the DNS records point at.
  dnsTunnel: production

# Previews: `forge env create` runs a branch in a namespace of its own.
# Needs apps.domain, apps.pullSecret and apps.routing "gateway".
previews:
  enabled: false

# Deploys: `forge deploy` writes to your forge-deploys repo and Argo CD
# deploys from it. Needs Argo CD in the namespace argocd, apps.domain and
# apps.pullSecret.
deploys:
  enabled: false
  # Defaults to "<org>/forge-deploys"; an empty repo with a main branch that
  # the GitHub App can write to.
  repo: ""
  # The chart services are deployed with; it is public.
  chart: oci://ghcr.io/showmino/forge-chart
  # Empty: this chart's appVersion. Changing it redeploys every service.
  chartRevision: ""
  # Existing namespaces named like *-staging or *-production that are not
  # Forge's: Argo CD never deploys a service into them.
  excludedNamespaces: []

# Resources: `forge resource` plans and applies a service's databases
# (CloudNativePG clusters, the operator must be installed) with OpenTofu Jobs
# in the namespace <release namespace>-runner. Needs deploys.
resources:
  enabled: false
  runner:
    image:
      repository: ghcr.io/showmino/forge-runner
      # Empty: v<appVersion>.
      tag: ""

# Cluster capacity: `forge cluster list/get` (admins) shows this cluster's
# nodes, CPU and memory, from metrics-server.
clusters:
  enabled: false
  name: default
  # Optional: Prometheus (adds disk and volumes), and a Grafana to link to.
  prometheusURL: ""
  grafanaURL: ""
  # Other clusters services may deploy to: the names of Argo CD's cluster
  # Secrets in the namespace argocd. forge-api reads exactly those.
  remote: []
```


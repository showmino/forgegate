---
sidebar_position: 20
---

# Chart Values

Every setting of the chart `oci://ghcr.io/showmino/charts/forge`, as of
version `0.29.0`. [Install Forge](17-running-your-own-forge.md) walks through
an install; this page is the reference. Put your settings in a values file
and pass it to every `helm install` and `helm upgrade`:

```sh
helm upgrade --install forge oci://ghcr.io/showmino/charts/forge -n forge -f forge-values.yaml
helm show values oci://ghcr.io/showmino/charts/forge --version 0.29.0   # the defaults, with comments
```

A values file holds only what differs from the defaults. The examples below
are complete files you can start from.

## Required

| Value | What |
| --- | --- |
| `github.org` | Your GitHub organization |
| `github.appID` | Your GitHub App's numeric ID, quoted (`"123456"`) |
| `host` | The address Forge is reached at, without a scheme |
| The Secret `github.existingSecret` | Created by you before the install (see [GitHub](#github)) |
| `ingress.className` or `gateway.parentRefs` | How the address reaches Forge (see [Address](#address)) |

With previews or deploys on, `apps.domain` and `apps.pullSecret` are required
too. The chart refuses to render without them and says which one is missing.

## Examples

### Ingress, cert-manager, the bundled database

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
```

### Gateway, previews and deploys, CloudNativePG with backups

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
  mode: cloudnativepg
  cloudnativepg:
    instances: 2
    size: 10Gi
    plugins:
      - name: barman-cloud.cloudnative-pg.io
        isWALArchiver: true
        parameters: {barmanObjectName: forge-db-backups}
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

### Your own PostgreSQL, deploys over an Ingress, images on another registry

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
  mode: external
  external:
    existingSecret: forge-db
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
| `github.adminTeams` | `<org>:platform-engineering` | The teams whose members are admins, comma separated, as `<org>:<team-slug>`. Everyone else who signs in can read, and change the services of their own teams |
| `github.templatesRepo` | `<org>/forge-templates` | The repo `forge create` scaffolds from (`owner/name`). See [Your Templates](19-write-your-templates.md) |

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
| `gateway.parentRefs` | `[]` | The Gateway to attach to, for example `[{name: my-gateway, namespace: gateway-system}]`. Required with `gateway.enabled` |

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
| `api.resources` | requests `cpu: 10m`, `memory: 32Mi`; limits `memory: 256Mi` | The API's resources. Template releases are cached in memory, up to 100 MiB each |

## Dashboard

| Value | Default | What |
| --- | --- | --- |
| `web.enabled` | `true` | Run the dashboard. `false` leaves only the API, the CLI and the login |
| `web.image.repository` | `ghcr.io/showmino/forge-web` | The dashboard's image |
| `web.image.tag` | `v0.1.34` (in `0.29.0`) | The dashboard has versions of its own; each chart release pins one |
| `web.replicas` | `1` | Dashboard pods |
| `web.resources` | requests `cpu: 10m`, `memory: 96Mi`; limits `memory: 384Mi` | The dashboard's resources |

## Login

| Value | Default | What |
| --- | --- | --- |
| `login.image` | `ghcr.io/dexidp/dex:v2.41.1` | The login (Dex) image |
| `login.host` | `""` | A host of its own for the login (optional). The GitHub App's callback URL is then `https://<login.host>/dex/callback` |
| `login.theme` | `true` | Dex's pages in Forge's look. `false` keeps Dex's own |

## Database

`database.mode` picks one of three:

| Mode | What you get |
| --- | --- |
| `bundled` (default) | One PostgreSQL pod with a volume, in this release. Its password is made once into the Secret `forge-db`, which `helm uninstall` keeps. **No backups** |
| `external` | Your own PostgreSQL server |
| `cloudnativepg` | A CloudNativePG Cluster (the operator must be installed), with backups through its plugins |

| Value | Default | What |
| --- | --- | --- |
| `database.mode` | `bundled` | `bundled`, `external` or `cloudnativepg` |
| `database.bundled.image` | `mirror.gcr.io/library/postgres:18` | The PostgreSQL image |
| `database.bundled.size` | `5Gi` | The volume's size |
| `database.bundled.storageClass` | `""` | Empty is the cluster's default StorageClass |
| `database.bundled.existingSecret` | `""` | Empty: the chart makes the Secret `forge-db` once and reads it back on every upgrade. With Argo CD or `helm template`, which cannot read it back, name a Secret of yours with `password` and `uri` (`postgres://forge:<password>@forge-db.<namespace>.svc:5432/forge?sslmode=disable`) |
| `database.external.existingSecret` | `""` | Required with `external`: a Secret with `uri` (the API's connection string, for example `postgres://forge:<password>@db.example.com:5432/forge?sslmode=require`) and `password` (the same password; the login needs it on its own) |
| `database.external.host` | `""` | Required with `external`: the server, for the login |
| `database.external.port` | `5432` | The server's port |
| `database.external.user` | `forge` | The user, who also owns the login's database |
| `database.external.loginDatabase` | `dex` | The login keeps its sessions in this second database on the same server. Create it before the install |
| `database.external.sslMode` | `require` | The login's `sslmode` |
| `database.cloudnativepg.instances` | `2` | PostgreSQL instances (one primary, the rest replicas) |
| `database.cloudnativepg.size` | `5Gi` | Each instance's volume |
| `database.cloudnativepg.storageClass` | `""` | Empty is the cluster's default StorageClass |
| `database.cloudnativepg.plugins` | `[]` | CloudNativePG plugins on the Cluster, for example backups with the Barman Cloud plugin (see the second example) |
| `database.cloudnativepg.serviceAccountAnnotations` | `{}` | Annotations on the database pods' ServiceAccount, for example a workload identity for the backups |
| `database.cloudnativepg.podLabels` | `{}` | Labels on the database pods |

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
| `argocdURL` | `""` | Argo CD's web address, to link a deployment to its Application (optional) |

With `apps.routing: ingress`, Argo CD waits for the controller to publish an
address on each Ingress. A controller that never does makes every deploy wait
for its sync timeout.

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

## CLI Downloads

| Value | Default | What |
| --- | --- | --- |
| `cliRepo` | `showmino/forge` | The GitHub releases `forge upgrade` and `/cli/` download the CLI from (`owner/name`) |

## When the Chart Refuses

`helm install` and `helm upgrade` stop before changing anything when a value
is wrong:

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
| `apps.ingress.annotations must not contain {{` | Argo CD's ApplicationSet would read it as a template; remove it |

## All Defaults

The chart's `values.yaml` at `0.29.0`, with its comments. `helm show values`
prints the same settings.

```yaml
# Forge for your GitHub organization. Required: github.org, github.appID,
# the Secret github.existingSecret, and host. Everything else has a default.

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

api:
  image:
    repository: ghcr.io/showmino/forge-api
    # Empty: v<appVersion>, the API this chart was released with.
    tag: ""
  # A host of its own for the API (optional; the dashboard then calls it
  # across origins, which the chart allows).
  host: ""
  resources:
    requests: {cpu: 10m, memory: 32Mi}
    # Template releases are cached in memory (up to 100 MiB each).
    limits: {memory: 256Mi}

web:
  enabled: true
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

database:
  # "bundled": one PostgreSQL pod with a volume, in this release. Its password
  # is generated once into the Secret forge-db, which an uninstall keeps.
  # No backups: use "cloudnativepg" or "external" for data you can't lose.
  # "external": a PostgreSQL server of yours (see external below).
  # "cloudnativepg": a CloudNativePG Cluster (the operator must be installed),
  # with backups through its plugins.
  mode: bundled
  bundled:
    image: mirror.gcr.io/library/postgres:18
    size: 5Gi
    # Empty: the cluster's default StorageClass.
    storageClass: ""
    # Empty: the chart makes the Secret forge-db once, and reads it back on
    # every upgrade. A tool that renders without access to the cluster (Argo
    # CD, helm template) would make a new password each time: name a Secret of
    # yours instead, with "password" and "uri"
    # (postgres://forge:<password>@forge-db.<namespace>.svc:5432/forge?sslmode=disable).
    existingSecret: ""
  external:
    # A Secret you create, with "uri" (the API's connection string, for
    # example postgres://forge:<password>@db.example.com:5432/forge?sslmode=require)
    # and "password" (the same password: the login needs it on its own).
    existingSecret: ""
    # For the login, which keeps its sessions in a second database on the
    # same server, owned by the same user. Create that database first.
    host: ""
    port: 5432
    user: forge
    loginDatabase: dex
    sslMode: require
  cloudnativepg:
    instances: 2
    size: 5Gi
    storageClass: ""
    # CloudNativePG plugins on the Cluster, for example backups with the
    # Barman Cloud plugin:
    #   - name: barman-cloud.cloudnative-pg.io
    #     isWALArchiver: true
    #     parameters: {barmanObjectName: forge-db-backups}
    plugins: []
    # Annotations on the database pods' ServiceAccount (a workload identity
    # for the backups) and labels on the pods.
    serviceAccountAnnotations: {}
    podLabels: {}

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

# Cluster capacity: `forge cluster list/get` (admins) shows this cluster's
# nodes, CPU and memory, from metrics-server.
clusters:
  enabled: false
  name: default
  # Optional: Prometheus (adds disk and volumes), and a Grafana to link to.
  prometheusURL: ""
  grafanaURL: ""
```


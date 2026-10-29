---
sidebar_position: 5
---

# Create a Service

You need the CLI, logged in to your Forge
([Install and log in](02-install-and-login.md)), and at least one template
(`forge template list`; a new Forge has none until you
[write your templates](03-write-your-templates.md)).

`forge create` makes a new service from a template in one step (to run an
image instead, see [Run an image](#run-an-image-instead-of-a-template)):

1. It renders the template.
2. It creates the private repo `github.com/my-org/<name>`.
3. It pushes the first commit, which starts CI. CI builds the image and
   deploys it to staging.
4. It adds the service to the catalog.

If a step fails after the repo exists, Forge deletes the repo again, so
nothing is left half made.

You may create a service for a team you are in (`forge auth can service.create
--team <team>` checks). Creating one for another team needs an admin.

## 1. Pick a Template

The templates are your organization's: a repo (by default
`my-org/forge-templates`) that the platform team keeps. The examples here use
two of them, `go-grpc` and `nextjs`. See what yours has:

```sh
forge template list
forge template get go-grpc        # parameters and the run options it offers
forge template get nextjs@v1.7.0  # one release of it
```

A template either makes a new service with its repo, CI, Dockerfile and
forge.yaml, or (a file template) opens a pull request in another repo (see
[File templates](#file-templates-a-pull-request-instead-of-a-repo)). To write
your own, see [Write your templates](03-write-your-templates.md).

## 2. Pick the Owning Team

Every service belongs to a GitHub team:

```sh
forge team list
```

## 3. Try It, Then Create It

```sh
forge create payments --template go-grpc --team billing --dry-run   # renders and lists the files; creates nothing
forge create payments --template go-grpc --team billing
```

The name must use lowercase letters, digits and hyphens, at most 63
characters. It becomes the repo name, the service name and part of its
address.

Forge shows each step as it happens. It gives the team (`--team`) the role
Maintain on the new repo (see [the owner team's access](12-catalog.md#the-owner-teams-access-to-the-repo)).
When it ends, the CI of the new repo is already running. About five minutes later the service runs in staging:

```sh
forge deploy status payments
```

## Common Variations

### Set Template Parameters

```sh
forge create ledger --template go-grpc --team billing --set port=9090
forge create ledger --template go-grpc@v1.7.0 --team billing   # pin a template release
```

In a terminal, forge asks for any required parameter you left out. In a
script (`--no-input`, or no terminal) it fails instead.

### Add Owners Besides the Team

```sh
forge create ledger --template go-grpc --team billing --owner ana@example.com --owner li@example.com
```

### Choose Who Can Reach It

Every service has an address under the cluster's apps domain, for example
`http://<name>.production.apps.example.com` and
`http://<name>.staging.apps.example.com`. Where the platform also offers
public domains (`forge domain list` shows them), a service is public by
default: production at `https://<name>.example.com` and staging at
`https://<name>-staging.example.com`. Then you choose:

| You want | Flag | In the dashboard | Written to forge.yaml |
| --- | --- | --- | --- |
| Staging and production on the internet | none | Public | nothing |
| Production on the internet, staging on the private network only | `--internal-staging` | Internal staging | `run.staging.public: false` |
| Both on the private network only (internal tools, APIs other services call) | `--internal` | Internal | `run.domain: none` |

```sh
forge create shop --template nextjs --team web --internal-staging
forge create billing-worker --template go-grpc --team billing --internal
```

### Choose the Domain

A public service is reached under one of the platform's public domains. See
which ones there are, the default first (an empty list means services have
internal addresses only):

```sh
forge domain list
```

Pick one with `--domain`. Forge writes it to forge.yaml as `run.domain`:

```sh
forge create gate --template nextjs --team web --domain example.org
# production: https://gate.example.org, staging: https://gate-staging.example.org
```

Without `--domain` the service gets the default domain. In the dashboard, the
**Name and owner** step has *Who can reach it* and a **Domain** list, and shows
the addresses the service will have. An internal service (`--internal`) has no domain, so `--domain` with
`--internal` is refused. A domain Forge does not offer is refused before
anything is created; to get another domain, ask your platform team.

You can change this later in forge.yaml. See [Addresses and visibility](08-addresses.md).

### Set How It Runs

The templates offer run options. Forge writes them into the new repo's
forge.yaml:

```sh
forge create shop --template nextjs --team web \
  --replicas 2 \
  --resources requests.cpu=100m,requests.memory=128Mi,limits.cpu=500m,limits.memory=512Mi \
  --env LOG_LEVEL=info \
  --secret stripe=vaults/Apps/items/shop-stripe:STRIPE_KEY=credential \
  --job 'cleanup=0 3 * * *:node cleanup.js' \
  --autoscaling-max 6
```

Forge refuses an option the template does not offer. See [Run options](09-run-options.md)
for what each one means.

## Run an Image Instead of a Template

To run an image someone else built, such as nginx, a tool from a vendor or
an image your other CI pushes, give `--image` instead of `--template`:

```sh
forge create web --image nginxinc/nginx-unprivileged:1.27 --health / --team web
```

Forge checks the image, creates the service and deploys it to staging, and
prints the deployment with its address. The service gets no repo. Its
forge.yaml, with `run.image: docker.io/nginxinc/nginx-unprivileged:1.27`, is
kept in your Forge's deploy repo, at `services/web/forge.yaml`.

Every Forge service runs as a non-root user, with a read-only filesystem
except `/tmp` and no extra privileges. So the image must say which user it
runs as, by number (its `USER`, such as `101`):

- An image that runs as root is refused before anything is created, with
  `runs as root ... Forge runs every service as a non-root user`. Many
  projects publish a non-root variant: `nginxinc/nginx-unprivileged` instead
  of `nginx`, `bitnami/...` images, or `-rootless` tags. Otherwise build your
  own image with a `USER` line.
- An image whose `USER` is a name (`USER nginx`) is refused too: Kubernetes
  can only check that a user given by number is not root.
- If the image writes to folders other than `/tmp`, name them with
  `--writable /var/cache/nginx` (repeatable; `run.writable` in forge.yaml).
  Each one starts empty, like `/tmp`. Without it, the app fails with
  `Read-only file system` when it writes there.

- `--port` is the port the image listens on (default 8080; the non-root
  nginx image listens on 8080, as a non-root user cannot use port 80), and `--health` the
  path probed to see it is ready (default `/healthz`). Every run option above
  may be set too.
- The image needs a tag, and not `latest`, which moves. Your Forge may also
  allow images only from some registries. A refused image exits 6 with the
  reason, such as `the tag latest moves; name a version, such as nginx:1.27`.
- An image your services' own CI pushes (under your Forge's image registry and
  organization, such as `ghcr.io/my-org/`) is refused: deploy it from its
  service's repo. So is a registry named by an address or a one-word name
  (`localhost:5000`), unless your Forge allows it by name.
- Public images need no login. A private one needs a login for its registry in
  your Forge's pull secret.
- `--deploy=false` only creates the service. `--dry-run` checks the image and
  the name, and creates nothing. With `-o json` or `-o yaml`, forge prints the
  staging deployment it ends with. If the deploy cannot start, the service is
  created anyway; run `forge deploy start <name> --env staging`.
- Such a service has no preview environments, since they are made from a
  branch. Deploy another tag with `forge deploy start web --env staging --ref
  1.28` (see [Deploy and release](07-deploy-and-release.md)).

## File Templates: a Pull Request Instead of a Repo

Some templates (`type: file` in `forge template get`) make no repo. They
render files and open a pull request that adds them to the template's target
repo, for example a request for a cloud account in an infrastructure repo:

```sh
forge create billing-account --template <file-template> --team platform-engineering \
  --set owner=ana@example.com --set costCenter=60168
```

The name only names the branch and the files. Forge prints the pull request's
URL; review and merge it there. Forge refuses if a file is already there.

## In the Dashboard

Open it with **Create service** in the top bar, next to the theme switch: it
is there on every page (at phone width, the **+** alone). The dashboard's
**Create** page (`https://forge.example.com/create`) walks through the same steps: Template,
Name and owner, Template inputs, How it runs and Review. Review has an **Edit**
link for each step. The panel beside the form shows the matching
`forge create` command as you fill it in.

The first step also asks where to start. **From a template** is the path
above. **From an image** runs an image, as `forge create --image` does: give
the image with its tag, and if it needs them, its port, health path and
**Writable folders** (`--writable`, comma-separated). The
steps are then Image, Name and owner, How it runs (every run option) and
Review; there are no template inputs. Review has a box, **Deploy it to
staging once it is created**, ticked by default: the page then deploys the
new service and follows the deploy live. Untick it for `--deploy=false`. A
refused image (such as one tagged `latest`) is shown with the reason, and
nothing is created.

The Team list shows your own teams first. The page refuses a team you are not
in, unless you are an admin. If you are in no team, the **Create service**
button is not there: ask an admin to add you to the team on GitHub.

## After Creating

- Clone the repo and work as usual. Every push to `main` deploys to staging.
- Add docs under `docs/` (see [Service docs](13-service-docs.md)).
- When staging looks right, promote it to production (see
  [Deploy and release](07-deploy-and-release.md)).

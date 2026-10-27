---
sidebar_position: 6
---

# Bring an Existing Repo

Use this when the app already exists, for example one deployed with a Helm
chart or a `.kube/values.yaml`, and you want Forge to run it instead.

## What Forge Needs From the Repo

| Need | Why |
| --- | --- |
| A `forge.yaml` at the root | It names the service and says how it runs |
| A catalog entry whose repo is this repo | CI may only deploy the service registered for its own repo |
| CI that pushes `ghcr.io/my-org/<service>:<7-char sha>` | Forge deploys the image CI built for the commit. The registry is the platform's (`imageRegistry` in the chart, `ghcr.io` by default) |
| A CI job that runs `forge deploy start --env staging` | That is how `main` reaches staging |
| An image that runs as a non-root user (`USER 1000` in the Dockerfile) | Pods run with `runAsNonRoot` and a read-only root filesystem; only `/tmp` is writable |
| An HTTP health path that answers 200 without calling other services | It is the readiness and liveness probe |

## 1. Write forge.yaml

```sh
cd my-app
forge init --team platform-engineering            # name defaults to the directory
forge init --name orders-api --team platform-engineering --lifecycle production
```

Then add the run settings. Here is a Helm values file translated to Forge:

```yaml
apiVersion: forge.dev/v1
service:
  name: orders-api
  team: platform-engineering
  lifecycle: production
  repo: https://github.com/my-org/orders-api   # must be exactly the repo's URL
run:
  port: 4000                 # Helm: port
  health: /health            # Helm: livenessProbe / readinessProbe path
  replicas: 2                # production; staging runs one
  resources:                 # Helm: resources
    requests: {cpu: 100m, memory: 192Mi}
    limits: {cpu: 500m, memory: 512Mi}
  autoscaling: {max: 6}      # Helm: autoscaling.maxReplicas (Forge scales on CPU)
  env:                       # Helm: env
    NODE_ENV: production
    GITHUB_ORG: my-org
  secrets:                   # Helm: onepassword + envVars
    - name: orders-api
      item: vaults/Apps/items/orders-api
      env: {PGUSER: username, PGPASSWORD: password}
    - name: orders-auth
      item: vaults/Apps/items/orders-auth
      env: {AUTH_API_TOKEN: apitoken}
```

What does not carry over from Helm, and why:

- **`image`**: Forge uses the image CI built for the deployed commit.
- **`host`, `gateway`, `istio`, `dnsZones`**: Forge gives every service its
  address (see [Addresses and visibility](08-addresses.md)). Where the
  platform offers public domains, use `run.host` or `run.domain` to change it.
- **Probe timings**: Forge sets them. You choose only the path.
- **A Prometheus-based autoscaler**: Forge scales on CPU between `replicas`
  and `autoscaling.max`.
- **Calling another service in the cluster**: use its Forge address. For
  example `PAYMENTS_URL: https://payments.example.com`, or its internal
  address (`http://payments.production.apps.example.com`).

Check the file without the API:

```sh
forge service options check
```

## 2. Register It in the Catalog

```sh
forge service register --dry-run   # validate on the server
forge service register             # reads ./forge.yaml
forge service get orders-api
```

Registering gives the owner team the role Maintain on the repo (see
[the owner team's access](12-catalog.md#the-owner-teams-access-to-the-repo)).

The catalog entry's repo must be exactly `https://github.com/my-org/<repo>`.
If CI says:

```text
error: CI token: repository "my-org/orders-api" is not a Forge service:
no catalog entry has repo_url https://github.com/my-org/orders-api
```

fix the repo URL on the entry:

```sh
forge service update orders-api --repo https://github.com/my-org/orders-api
```

## 3. Add the CI Jobs

Copy `.github/workflows/ci.yml` from a template in your templates repo, or
from the `hello` template of
[showmino/forge-example-templates](https://github.com/showmino/forge-example-templates),
and keep your own test steps. The parts Forge needs:

```yaml
  image:
    needs: test
    runs-on: ubuntu-latest
    permissions: {contents: read, packages: write}
    env:
      SHA: ${{ github.event.pull_request.head.sha || github.sha }}
    steps:
      - uses: actions/checkout@v4
        with: {ref: "${{ env.SHA }}"}
      - uses: docker/login-action@v3
        with: {registry: ghcr.io, username: "${{ github.actor }}", password: "${{ secrets.GITHUB_TOKEN }}"}
      - run: |
          image=ghcr.io/my-org/<service>:${SHA::7}
          docker build -t "$image" . && docker push "$image"

  deploy:
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    needs: image
    runs-on: ubuntu-latest         # or your own runners, if the API is not on the internet
    concurrency: {group: forge-deploy-staging, cancel-in-progress: false}
    permissions: {contents: read, id-token: write}
    env:
      FORGE_API_URL: ${{ vars.FORGE_API_URL }}
    steps:
      - uses: actions/checkout@v4
      - run: |
          curl -fsS --retry 3 -o "$RUNNER_TEMP/forge" "$FORGE_API_URL/cli/forge-linux-amd64"
          chmod +x "$RUNNER_TEMP/forge"
      - run: '"$RUNNER_TEMP/forge" deploy start --env staging'
```

The deploy job needs no secret. `id-token: write` lets the CLI log in with the
job's own GitHub OIDC token. `FORGE_API_URL` is your Forge's address, kept in
an organization or repository variable.

## 4. Push, Then Remove the Old Deploy

Push to `main`. CI deploys to staging. Check it:

```sh
forge deploy status orders-api
```

When staging works, promote it (`forge deploy promote orders-api`). Then
remove what deployed the app before, for example the `.kube` directory that
an ApplicationSet picked up, so the app does not run twice.

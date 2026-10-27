---
sidebar_position: 8
---

# Preview Environments

A preview runs a service's CI image for one Git ref (a branch, a tag or a
commit) in its own namespace, with its own URL, until its time to live (TTL)
runs out. Use one to show a branch to someone, or to test a pull request
before it is merged.

## Create One

```sh
forge env create pr-142 --service payments --ref feature/x --ttl 48h
forge env create demo                         # inside the repo: this service, main, 24h
forge env create demo --dry-run               # resolve and check only
```

Forge:

1. resolves `--ref` in the service's repo to a commit,
2. waits until CI has pushed the image for that commit,
3. creates the namespace `preview-<name>`,
4. waits until the service is ready.

It then prints the URL, `http://<name>.preview.<apps domain>`, for example
`http://pr-142.preview.apps.example.com`. Who can reach it is the platform's
choice, as for [internal addresses](06-addresses.md#internal-addresses).

Previews must be switched on in the chart: `previews.enabled`, with
`apps.domain`, `apps.pullSecret` and `apps.routing: gateway`. Otherwise
`forge env create` is refused.

CI builds images for pull requests from branches in the same repo, so a
branch with an open pull request has an image.

## Find and Inspect

```sh
forge env list
forge env list --service payments
forge env get pr-142
```

## Keep It Longer

```sh
forge env extend pr-142 --ttl 48h    # expires 48h from now; 1h to 168h
```

## Remove It

```sh
forge env destroy pr-142             # asks you to type the name
forge env destroy pr-142 --yes
```

A preview is removed when its TTL runs out. Destroying a preview that is
still being created cancels the create first.

## Start Now, Watch Later

```sh
forge env create demo --wait=false   # prints the operation id
forge op watch op_9f2c4a1b0c3d
```

## In the Dashboard

The Environments page lists every preview with the time it has left.

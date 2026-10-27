---
sidebar_position: 4
---

# Your Templates

You need Forge installed ([Install Forge](01-running-your-own-forge.md)) and
the CLI ([Install and log in](02-install-and-login.md)). Then, before anyone
can create a service, your organization needs templates.

`forge create` makes new services from the templates repo of your
organization, `<org>/forge-templates` (or the repo your install names in
`github.templatesRepo`). A new install has no templates. This page starts
yours from an example: one Go web service whose CI runs on GitHub-hosted
runners, pushes its image to ghcr.io and deploys through Forge.

The example is the public repo
[`showmino/forge-example-templates`](https://github.com/showmino/forge-example-templates).
[Templates](16-templates.md) has the format in full.

## 1. Copy the Example

The Forge GitHub App must be installed on the repo; with "All repositories"
(as [Install Forge](01-running-your-own-forge.md) says) it already is.

```sh
gh repo clone showmino/forge-example-templates
gh repo create <org>/forge-templates --private --clone   # skip if it exists
cp -r forge-example-templates/hello forge-example-templates/.github \
  forge-example-templates/README.md forge-templates/
cd forge-templates
```

## 2. Tell It Where Forge Is

The service's CI downloads the `forge` CLI from your Forge and deploys
through it, so it needs Forge's address. Set the default of `forgeApi` in
`hello/template.yaml`:

```yaml
  - name: forgeApi
    type: string
    default: "https://forge.example.com"
```

The organization variable `FORGE_API_URL` overrides it. On GitHub Free,
private repositories cannot read organization variables, and the repos
`forge create` makes are private, so the default is what they use there.

## 3. Check and Release

```sh
forge template lint            # needs no login and no Forge
git add -A && git commit -m "The hello template"
git push origin main
git tag v1.0.0 && git push origin v1.0.0
forge template list            # hello  v1.0.0  ...
```

`forge create` uses the newest tag. Change a template the same way: commit,
lint, push, tag `v1.0.1`.

## 4. Let Forge Pull the Images

The example's CI pushes `ghcr.io/<org>/<service>:<commit>`. The image is
private, like its repo, so Forge needs a token that can read your
organization's packages: a GitHub personal access token (classic) with only
the scope `read:packages`, from someone in the organization.

```sh
kubectl -n forge create secret docker-registry registry \
  --docker-server=ghcr.io --docker-username=<github user> \
  --docker-password=<token>
```

In your values (`imageRegistry` empty means ghcr.io):

```yaml
imageRegistry: ""
apps:
  pullSecret: registry
```

Then `helm upgrade` as in [Install Forge](01-running-your-own-forge.md#upgrade).
Forge checks that an image exists with this Secret and copies it into each
service's namespace.

## 5. Make a Service and Ship It

```sh
forge create hello-world --template hello --team <your team>
```

Forge makes the repo `<org>/hello-world` and pushes the first commit. Its CI
(Actions tab of the repo) runs three jobs on `ubuntu-latest`:

| Job | What it does |
| --- | --- |
| `test` | `go vet` and `go test -race` |
| `image` | builds the Dockerfile and pushes the image with the workflow's own `GITHUB_TOKEN` |
| `deploy` | downloads `forge` from `<forgeApi>/cli/` and runs `forge deploy start --env staging`, signed in with the job's GitHub OIDC token |

The OIDC token lets the job deploy only its own service, only to staging,
only at the commit it runs for. No secret is stored in the repo.

```sh
forge deploy status hello-world        # staging, at the pushed commit
forge deploy promote hello-world --yes # to production
```

## When Something Is Wrong

| What you see | What it means |
| --- | --- |
| `forge template list` does not show `hello` | The repo has no tag yet, or the tag is on a commit without `hello/` |
| The `deploy` job says "set the organization variable FORGE_API_URL" | `forgeApi` was empty when the service was made: put the address in the `env` at the top of its `.github/workflows/ci.yml` |
| The `deploy` job cannot download `forge` | The address is not reachable from GitHub's runners; Forge must be on an address the internet can reach |
| The `image` job is refused with `denied` | A package of that name already exists and is not linked to this repo: in the package's settings give the repo write access, or delete the package |
| The deploy says `waiting for ghcr.io/... registry: ... 401` (or 403), then "did not appear within" | Forge cannot read the image: `apps.pullSecret` is not set, or its token lacks `read:packages` or belongs to someone outside the organization |

---
sidebar_position: 17
---

# Templates

`forge create` scaffolds a service from a template. Templates live in
your organization's templates repo (by default `my-org/forge-templates`, the
chart's `github.templatesRepo`) and are released by tags on the whole repo
(`v1.7.0`). `forge create` uses the newest tag unless you pin one
(`--template go-grpc@v1.6.0`).

## Find a Template

```sh
forge template list                    # name, newest version, tags, description
forge template list --tag web
forge template list --version v1.6.0   # what a release had
forge template get nextjs              # parameters, options, files
forge template get go-grpc@v1.6.0 -o yaml
```

Which templates there are is your platform team's choice. To start a
templates repo, see [Write your templates](03-write-your-templates.md).

## Write or Change a Template

A template is a directory in the templates repo:

```text
my-template/
  template.yaml     # what it is and the parameters it asks for
  skeleton/         # the files of the new repo, rendered with Go text/template
```

```yaml
apiVersion: forge.dev/v1
kind: Template
name: my-template
title: My template
description: One line that says what it scaffolds
tags: [go, web]
owner: platform-engineering
delimiters: ["{%", "%}"]       # so ${{ }} in GitHub Actions and {{ }} in JSX survive
parameters:
  - name: port
    type: int                  # string, int, bool, enum or list
    default: 8080
    min: 1
    max: 65535
    description: Port the server listens on
  - name: flavour
    label: Flavour             # the label in the dashboard's form
    type: enum
    values: [small, large]
options: [replicas, resources, env, secrets, jobs, autoscaling]
```

- `options` lists the run options the create form and `forge create` offer
  for this template (see [Run options](09-run-options.md)).
- `type: file` with `target: <org>/<repo>` makes it a file template: the
  skeleton is added to that repo by pull request.

In `skeleton/`, file names and contents can use:

| Value | What |
| --- | --- |
| `{% .Service.Name %}`, `.Service.Team`, `.Service.Owners` | The new service |
| `{% .Repo.Owner %}`, `.Repo.Name`, `.Repo.URL` | Its repository |
| `{% .Params.port %}` | A parameter, typed (an `int` is a number, a `bool` is true or false) |

## Check a Template

```sh
forge template lint                 # every template in the current directory
forge template lint ./my-template
```

Lint needs no login and no API. It checks `template.yaml`, renders the
skeleton with sample values and exits 1 if anything is wrong.

## Release

1. Open a pull request in the templates repo. Its CI lints and renders every
   template.
2. Merge it once CI passes.
3. Tag the merge commit on `main` (`v1.8.0`). `forge create` and the
   dashboard use the new tag from then on.

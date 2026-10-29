---
sidebar_position: 19
---

# Command Reference

Every `forge` command with its flags, as `forge <command> --help` prints them
for the current release. The other pages explain when to use which.

## Flags Every Command Takes

```text
    --api-url string     Forge API URL, overriding the context
-c, --context string     Forge context to use (see 'forge context list')
-n, --namespace string   namespace, overriding forge.yaml and the context
    --no-color           disable colour (also NO_COLOR)
    --no-input           fail instead of prompting (implied when stdin is not a terminal)
-o, --output string      output format: table, json, yaml or name
-q, --quiet              print only results and errors
    --timeout duration   give up after this long, for example 30s (0 = no limit)
-v, --verbose            print request IDs and where settings came from
```

## forge audit

### forge audit get

Show one audit event.

```text
forge audit get <id> [flags]
```

```sh
forge audit get 1234
forge audit get auditEvents/1234 -o json
```

### forge audit list

List audit events, newest first.

```text
forge audit list [flags]

--action string    only this action, for example deploy.promote
--actor string     only events by this actor: an email, a repository <org>/<repo>, system or anonymous
--failed           only events whose result is not ok
--limit int        most events to show (default 50)
--service string   only events about this service
--since string     only events at or after this: a duration back from now (24h, 7d) or an RFC 3339 time
--until string     only events before this: a duration back from now or an RFC 3339 time
```

```sh
forge audit list --service payments --since 7d
forge audit list --actor ana@example.com --failed
forge audit list --action deploy.promote -o json
```

## forge cluster

For admins: the Kubernetes clusters Forge knows: the one it runs on and any
others its API was given (through Argo CD's credentials); their nodes, their
conditions and how much of their CPU and memory is in use.

### forge cluster get

Show a cluster, its nodes and its volumes.

```text
forge cluster get <name> [flags]
```

```sh
forge cluster get default
forge cluster get default -o json | jq '.nodes[] | select(.condition != "Ready")'
```

### forge cluster list

List the clusters with their status and use. The figures are over the nodes
that take new pods. A cluster the Forge API could not read says Unavailable,
and why.

```text
forge cluster list [flags]
```

```sh
forge cluster list
forge cluster list -o json | jq '.clusters[].totals'
```

## forge create

Create a service from a template or an image.

```text
forge create <name> (--template <template>[@version] | --image <image>) --team <team> [flags]

--autoscaling-max int   run option: let production grow on CPU up to this many pods
--deploy                with --image: deploy it to staging and watch the deploy (default true)
--domain string         the public domain the service is reached under (run.domain); 'forge domain list' shows them, the default first
--dry-run               render and check without creating anything; print the files
--env stringArray       run option: an environment variable as NAME=value (repeatable)
--health string         with --image: the path its readiness is probed at (default /healthz)
--image string          an image to run instead of a template, such as nginx:1.27; the service gets no repo
--internal              reach the service only on the platform's network, with no public address (run.domain: none)
--internal-staging      reach staging only on the platform's network; production stays public (run.staging.public: false)
--job stringArray       run option: a cron job as name=<schedule>:<command>, e.g. 'cleanup=0 3 * * *:node cleanup.js' (repeatable)
--owner strings         owner email or handle (repeatable)
--port int              with --image: the port it listens on (default 8080)
--replicas int          run option: production's pod count (staging runs one)
--resources strings     run option: requests.cpu=100m,requests.memory=128Mi,limits.cpu=500m,limits.memory=512Mi
--secret stringArray    run option: a 1Password item as name=vaults/<vault>/items/<item>:VAR=field,VAR2=field (repeatable)
--set stringArray       template parameter as name=value (repeatable)
--team string           owning team
--template string       template to use, optionally with @version (see 'forge template list')
--writable strings      with --image: folders it writes besides /tmp, such as /var/cache/nginx (repeatable)
```

```sh
forge create payments --template go-grpc --team billing
forge create ledger --template go-grpc@v1.0.0 --team billing --owner ana@example.com --set port=9090
forge create shop --template nextjs --team web --replicas 2 --env LOG_LEVEL=info \
  --secret stripe=vaults/Apps/items/shop-stripe:STRIPE_KEY=credential --job 'cleanup=0 3 * * *:node cleanup.js'
forge create payments --template go-grpc --team billing --dry-run
forge create web --image nginxinc/nginx-unprivileged:1.27 --health / --team web
```

## forge deploy

### forge deploy history

List past deploys, rollbacks and promotions.

```text
forge deploy history [service] --env staging|production [flags]

--env string    staging or production
--limit int32   show at most this many records (default 20)
```

```sh
forge deploy history payments --env production --limit 5
```

### forge deploy promote

Deploy what runs in one environment to the next.

```text
forge deploy promote [service] [flags]

    --bump string   how far the version goes up: patch (default), minor or major
    --dry-run       check without promoting
    --from string   environment to take the image from (default "staging")
    --to string     environment to deploy it to (default "production")
    --wait          watch the promotion until it ends (default true)
-y, --yes           skip the confirmation prompt
```

```sh
forge deploy promote payments --yes
forge deploy promote payments --bump minor
forge deploy promote payments --dry-run
```

### forge deploy rollback

Restore a previous version of a service.

```text
forge deploy rollback [service] --env staging|production [flags]

    --dry-run      check without rolling back
    --env string   staging or production
    --to string    deploy commit to restore (default: the one before the current)
    --wait         watch the rollback until it ends (default true)
-y, --yes          skip the confirmation prompt
```

```sh
forge deploy rollback payments --env production --yes
forge deploy rollback payments --env staging --to 9f8e7d6 --dry-run
```

### forge deploy start

Deploy a ref of a service to an environment.

```text
forge deploy start [service] --env staging|production [flags]

--bump string   for a first deploy of a commit to production: patch (default), minor or major
--dry-run       check and resolve without deploying
--env string    staging or production
--ref string    branch, tag or commit (default $GITHUB_SHA in GitHub Actions, else main); for a service without a repo, the image tag
--wait          watch the deploy until it ends (default true)
```

```sh
forge deploy start payments --env staging
forge deploy start --env staging --ref v1.4.2    # in a service repo
forge deploy start web --env staging --ref 1.28  # a service that runs nginx
```

### forge deploy status

Show what is deployed.

```text
forge deploy status [service] [--env staging|production] [flags]

--env string   only this environment
```

```sh
forge deploy status
forge deploy status payments --env production
```

## forge docs

### forge docs get

Print a page of a service's docs.

```text
forge docs get [service] [page] [flags]

--pages   list the pages instead of printing one
```

```sh
forge docs get payments
forge docs get payments runbook.md
forge docs get payments --pages
forge docs get payments api/errors.md -o json | jq -r .editUrl
```

### forge docs lint

Check a repo's docs, without the API.

```text
forge docs lint [dir] [flags]
```

```sh
forge docs lint
forge docs lint ../payments -o json | jq -r '.findings[].message'
```

### forge docs list

List the services that have docs.

```text
forge docs list [flags]
```

```sh
forge docs list
forge docs list -o json | jq -r '.docSets[].service'
```

### forge docs search

Find the pages of every service's docs that hold some words.

```text
forge docs search <words>... [flags]

--limit int32      how many pages to show (default 20, at most 100)
--service string   search one service's docs only
```

```sh
forge docs search restart queue
forge docs search --service payments refund
forge docs search alert -o json | jq -r '.results[] | .service + " " + .path'
```

## forge domain

### forge domain list

List the public domains, the default first.

```text
forge domain list [flags]
```

```sh
forge domain list
forge domain list -o name
```

## forge env

### forge env create

Run a service's CI image in a new preview environment.

```text
forge env create <name> [flags]

--dry-run          check and resolve without creating anything
--ref string       branch, tag or commit to run (default "main")
--service string   service to run (default: forge.yaml's service)
--ttl duration     lifetime, 1h to 168h (default 24h0m0s)
--wait             watch the create until it ends (default true)
```

```sh
forge env create pr-142 --service payments --ref feature/x --ttl 48h
forge env create demo                  # in a service repo
forge env create demo --wait=false     # then: forge op watch <id>
```

### forge env destroy

Remove a preview environment.

```text
forge env destroy <name> [flags]

    --dry-run   check without destroying anything
    --wait      watch the destroy until it ends (default true)
-y, --yes       skip the confirmation prompt
```

```sh
forge env destroy pr-142 --yes
forge env destroy pr-142 --dry-run
```

### forge env extend

Set a preview environment to expire after --ttl from now.

```text
forge env extend <name> --ttl <duration> [flags]

--ttl duration   new lifetime from now, 1h to 168h
```

```sh
forge env extend pr-142 --ttl 48h
```

### forge env get

Show a preview environment.

```text
forge env get <name> [flags]
```

```sh
forge env get pr-142
```

### forge env list

List preview environments.

```text
forge env list [flags]

--service string   only environments of this service
```

```sh
forge env list
forge env list --service payments -o json
```

## forge op

### forge op cancel

Stop a running operation.

```text
forge op cancel <id> [flags]

    --wait   watch the operation until it has stopped
-y, --yes    skip the confirmation prompt
```

```sh
forge op cancel op_9f2c4a1b0c3d --yes
forge op cancel op_9f2c4a1b0c3d --yes --wait
```

### forge op list

List operations, newest first.

```text
forge op list [flags]

--running         only operations that are still running
--target string   only operations on this resource, for example environments/pr-142
```

```sh
forge op list
forge op list --running
forge op list --target environments/pr-142 -o json
```

### forge op watch

Stream an operation's progress until it ends.

```text
forge op watch <id> [flags]
```

```sh
forge op watch op_9f2c4a1b0c3d
forge op watch op_9f2c4a1b0c3d --timeout 5m
```

## forge resource

### forge resource apply

Apply a saved plan.

```text
forge resource apply [plan] [--env staging|production] [flags]

    --dry-run       run every check without applying
    --env string    apply your newest ready plan for this environment
-f, --file string   manifest to check the plan against (default: forge.yaml here or in a parent directory)
    --wait          watch the apply until it ends (default true)
-y, --yes           skip the confirmation prompt
```

```sh
forge resource apply --env staging
forge resource apply resourcePlans/7f3a91c2b04e --yes
forge resource apply --env production --dry-run
```

### forge resource get

Show one resource.

```text
forge resource get <service>/<env>/<name> [flags]
```

```sh
forge resource get payments/staging/main
forge resource get resources/payments/production/main -o json
```

### forge resource list

List resources with their state and live health.

```text
forge resource list [service] [--env staging|production] [flags]

--env string   only this environment
```

```sh
forge resource list
forge resource list payments --env production -o json
```

### forge resource plan

Show what forge.yaml's resources would change, and check it against policy.

```text
forge resource plan --env staging|production [flags]

    --allow-destroy   let the plan delete resources
    --env string      staging or production
-f, --file string     manifest to read (default: forge.yaml here or in a parent directory)
    --wait            watch the plan until it is made (default true)
```

```sh
forge resource plan --env staging
forge resource plan --env production -f ./forge.yaml
forge resource plan --env staging --allow-destroy
```

## forge service

### forge service address

Show or change where a service is reached.

```text
forge service address [name] [flags]

    --claim strings   an address in use to take over (repeatable)
    --clear           go back to forge.yaml's run.host and run.domain
    --domain string   one of the platform's public domains, or "none"
    --dry-run         show where each environment would go without changing anything
    --host string     the name before the domain; "@" for the domain itself
-y, --yes             skip the confirmation prompt
```

```sh
forge service address website
forge service address website --host @ --domain example.com --dry-run
forge service address website --host @ --domain example.com --claim example.com
forge service address website --clear
```

### forge service delete

Delete a service and everything it runs.

```text
forge service delete <name> [flags]

    --dry-run   check that the delete would be accepted without deleting anything
-y, --yes       skip the confirmation prompt
```

```sh
forge service delete payments
forge service delete payments --yes
forge service delete payments --dry-run
```

### forge service deps

List the services a service depends on.

```text
forge service deps [name] [flags]
```

```sh
forge service deps ledger
forge service deps ledger -o json
```

### forge service get

Show one service.

```text
forge service get [name] [flags]
```

```sh
forge service get payments
forge service get payments -o yaml
```

### forge service list

List services in the catalog.

```text
forge service list [flags]

--limit int     return at most this many services (0 = all)
--team string   only services owned by this team
```

```sh
forge service list
forge service list --team billing -o json | jq -r '.services[].name'
```

### forge service options check

Check forge.yaml's run options and show what each environment gets, without the API.

```text
forge service options check [dir] [flags]
```

```sh
forge service options check
forge service options check ../payments -o json
```

### forge service options set

Change run options in the repo's forge.yaml, without the API.

```text
forge service options set <key>=<value>... [flags]

--dir string   the repo whose forge.yaml to change (default ".")
```

```sh
forge service options set replicas=3 autoscaling.max=6
forge service options set env.LOG_LEVEL=debug resources.limits.memory=256Mi
forge service options set autoscaling.max=
```

### forge service owners

List a service's team and owners.

```text
forge service owners [name] [flags]
```

```sh
forge service owners payments
forge service owners -o name     # inside the repo
```

### forge service register

Add a service to the catalog.

```text
forge service register [name] [flags]

--depends-on strings     service this one depends on (repeatable)
--display-name string    human-friendly name
--dry-run                validate on the server without registering
--label stringToString   label as key=value (repeatable) (default [])
--lifecycle string       experimental, production or deprecated
--owner strings          owner email or handle (repeatable)
--repo string            source repository URL
--team string            owning team
```

```sh
forge service register payments --team billing --owner ana@example.com --lifecycle production
forge service register            # from ./forge.yaml
forge service register ledger --team billing --depends-on payments --dry-run
```

### forge service update

Change fields of a service.

```text
forge service update [name] [flags]

--add-owner strings      add an owner (repeatable)
--depends-on strings     service this one depends on (repeatable)
--display-name string    human-friendly name
--dry-run                validate on the server without changing anything
--label stringToString   label as key=value (repeatable) (default [])
--lifecycle string       experimental, production or deprecated
--owner strings          owner email or handle (repeatable)
--remove-owner strings   remove an owner (repeatable)
--repo string            source repository URL
--team string            owning team
```

```sh
forge service update payments --lifecycle deprecated
forge service update payments --add-owner li@example.com --remove-owner ana@example.com
```

## forge team

### forge team list

List the organization's teams.

```text
forge team list [flags]
```

```sh
forge team list
forge team list -o json | jq -r '.teams[].name'
```

## forge template

### forge template get

Show a template and its parameters.

```text
forge template get <name>[@version] [flags]
```

```sh
forge template get go-grpc
forge template get go-grpc@v1.0.0 -o json | jq '.parameters'
```

### forge template lint

Check templates for errors, without the API.

```text
forge template lint [dir] [flags]
```

```sh
forge template lint                  # every template in the current directory
forge template lint go-grpc
forge template lint -o json | jq -r '.findings[].message'
```

### forge template list

List the templates of a release.

```text
forge template list [flags]

--tag string       only templates with this tag
--version string   release tag (default: the newest)
```

```sh
forge template list
forge template list --tag go
forge template list --version v1.0.0 -o json | jq -r '.templates[].name'
```

## forge auth

### forge auth can

Check whether you may do an action, on a service or (for `service.create`,
`service.register` and `cluster.read`) on none. Prints `yes` or `no` and exits
0 or 5. The actions: `service.create`, `service.create.any_team`,
`service.register`, `service.update`, `service.update.team`, `service.delete`,
`service.address`, `deploy.start`, `deploy.promote`, `deploy.rollback`,
`environment.create`, `environment.extend`, `environment.destroy`,
`operation.cancel`, `resource.plan`, `resource.apply`,
`resource.apply.production`, `cluster.read`.

```text
forge auth can <action> [service] [flags]

--team string   for service.create: the team the new service would belong to
```

```sh
forge auth can deploy.promote payments
forge auth can service.create --team billing
forge auth can resource.apply.production payments -o json
```

### forge auth login

Log in with the OIDC device flow.

```text
forge auth login [flags]
```

```sh
forge auth login
forge auth login --context prod
```

### forge auth logout

End the session and remove stored credentials for the current context.

```text
forge auth logout [flags]
```

```sh
forge auth logout
forge auth logout --context prod
```

### forge auth session list

List your sessions, newest first.

```text
forge auth session list [flags]
```

```sh
forge auth session list
forge auth session list -o json
```

### forge auth session revoke

End one of your sessions at once.

```text
forge auth session revoke <session> [flags]
```

```sh
forge auth session revoke ses_4f2a9c1d0b3e5a67
```

### forge auth status

Show who you are logged in as and what you may do.

```text
forge auth status [flags]
```

```sh
forge auth status
forge auth status -o json | jq -r .permissions[]
```

### forge auth token

Print a valid bearer token for the current context.

```text
forge auth token [flags]
```

```sh
curl -H "Authorization: Bearer $(forge auth token)" \
  https://forge.example.com/forge.v1.AuthService/GetStatus -H 'Content-Type: application/json' -d '{}'
```

## forge completion

Generate the autocompletion script for the specified shell.

```text
forge completion [command]
```

## forge context

### forge context current

Print the context commands will use.

```text
forge context current [flags]
```

```sh
forge context current
FORGE_CONTEXT=prod forge context current -v
```

### forge context delete

Remove a context.

```text
forge context delete <name> [flags]
```

```sh
forge context delete staging-eu
```

### forge context list

List contexts.

```text
forge context list [flags]
```

```sh
forge context list
forge context list -o json
```

### forge context set

Create or update a context.

```text
forge context set <name> [flags]

--api string   Forge API URL
--use          also make it the current context
```

```sh
forge context set staging-eu --api https://forge.staging.example.com --namespace billing
forge context set local --api http://localhost:8080 --use
```

### forge context use

Make a context the default.

```text
forge context use <name> [flags]
```

```sh
forge context use staging-eu
```

## forge doctor

Check config, API reachability, version skew and login.

```text
forge doctor [flags]
```

```sh
forge doctor
forge doctor --context prod -o json
```

## forge init

Write a forge.yaml for the repo in the current directory.

```text
forge init [flags]

--force              overwrite an existing forge.yaml
--lifecycle string   experimental, production or deprecated (default "experimental")
--name string        service name (default: directory name)
--owner strings      owner email or handle (repeatable)
--team string        owning team
```

```sh
forge init --team billing
forge init --name payments --team billing --owner ana@example.com --lifecycle production
```

## forge upgrade

Upgrade forge to the Forge API's version.

```text
forge upgrade [flags]

--allow-downgrade   install the API's version also when it is older
--check             only say whether there is another version
```

```sh
forge upgrade --check
forge upgrade
```

## forge version

Print the CLI version and the server version of the current context.

```text
forge version [flags]

--client   print only the client version; do not contact the server
```

```sh
forge version
forge version --client -o json
```

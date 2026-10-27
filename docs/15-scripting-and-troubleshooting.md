---
sidebar_position: 15
---

# Scripting and Troubleshooting

## Output for Scripts

Every command takes `-o`:

| Format | What you get |
| --- | --- |
| `table` | For people (the default in a terminal) |
| `json`, `yaml` | The resource itself, as the API returns it |
| `name` | One resource name per line, for `xargs` and loops |

```sh
forge service list -o name
forge deploy status payments -o json | jq -r '.deployments[] | "\(.env) \(.version)"'
forge audit list --failed --since 24h -o json
```

`-q` prints only results and errors. `--no-input` makes a command fail
instead of asking; it is on whenever stdin is not a terminal, so scripts and
CI never hang on a prompt. Destructive commands then need `--yes`.

## Exit Codes

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Unexpected error |
| 2 | Invalid usage (a wrong flag or argument) |
| 3 | Not found |
| 4 | Not authenticated: run `forge auth login` |
| 5 | Permission denied, or refused by policy |
| 6 | Conflict or failed precondition (for example a stale etag or plan) |
| 7 | The operation ran and failed |
| 8 | Timed out (`--timeout`, or a wait) |

```sh
forge deploy start --env staging
case $? in
  0) echo deployed ;;
  7) echo "the rollout failed" ;;
  8) echo "still running; check: forge op list" ;;
esac
```

## Where Settings Come From

The first of these that is set wins:

1. Flags (`--api-url`, `--context`, `--namespace`, `-o`).
2. Environment: `FORGE_API_URL`, `FORGE_CONTEXT`, `FORGE_NAMESPACE`,
   `FORGE_OUTPUT`, `FORGE_TOKEN`, `FORGE_CONFIG` (the config file's path).
3. The repo's forge.yaml (the service and its namespace).
4. Your config: the current context (`forge context list`).
5. Built-in defaults: none for the API. Set it once with
   `forge context set <name> --api <url> --use`.

`forge -v <command>` prints where each setting came from.

`FORGE_TOKEN` replaces your stored login. CI uses it with a token Forge
issues for the workflow (see [Deploy and release](05-deploy-and-release.md#from-ci));
do not put a personal session in it.

## Troubleshooting

Start with:

```sh
forge doctor     # config, API reachable, CLI and API versions, login
forge version
```

| You see | What it means | Fix |
| --- | --- | --- |
| `not authenticated` (exit 4) | No login, or the session ended | `forge auth login` |
| `Cloudflare challenged the request to <host> from your network ... (Ray ID <id>)` (exit 1) | Cloudflare asked for a browser check, often on a company network or VPN. The request never reached Forge. Older CLIs say `identity provider discovery at ... returned 403 Forbidden` | Try another network. Otherwise send the Ray ID to your platform team: it finds the rule under Security > Events in Cloudflare |
| `<you> may not <action> on services/<name>: it needs the team <org>:<team> or an admin` (exit 5) | You are not in the service's team | Ask to be added to the team, or ask a member. `forge auth can <action> <name>` checks first |
| `<you> may not <action>: only an admin may` (exit 5) | The action is admin only (delete, address, register, production resources, ...) | Ask an admin (by default a member of `<org>:platform-engineering`) |
| `promoting services/<name> to production is denied by policy: staging is ...` (exit 5) | Staging is not Synced, not Healthy, or still on the deploy before | `forge deploy status <name> --env staging`; fix staging or wait for the deploy, then promote again. A rollback is never refused |
| `CI token: repository "<org>/<repo>" is not a Forge service: no catalog entry has repo_url ...` | The catalog's repo URL does not match the repo CI runs in | `forge service update <name> --repo https://github.com/<org>/<repo>`; see [Bring an existing repo](03-bring-an-existing-repo.md) |
| `field <x> not found in type manifest.<Y>` | A typo in forge.yaml, or a field newer than the API that runs | Fix the name; check with `forge service options check`. A field the API does not know yet must wait for its upgrade |
| A warning that the CLI and API versions differ | Version skew | `forge upgrade` |
| HTTP 530 or 404 on a public address | Cloudflare has no route yet, or the deploy did not finish | `forge deploy status`; see [Addresses](06-addresses.md) |
| `resources are not configured on this Forge API` | Resources are not switched on yet | See [Resources](12-resources.md) |
| A command hangs in a pipeline | It is waiting for an operation | `--wait=false`, or `--timeout 10m` |

When you ask for help, include the output of `forge -v <command>`: it has the
request ID your platform team can find in the logs.

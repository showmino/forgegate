---
sidebar_position: 22
---

# Rules

Forge checks rules before it applies a resource plan, promotes staging to
production, runs an image or a Helm chart, or makes an infrastructure repo.
Some rules are the platform's choices, and an admin can set how strict each
one is. The others guard Forge itself and are always enforced.

```sh
forge policy list
```

```text
RULE                         KIND        MODE                      TITLE
images.pinned-version        Images      enforce                   Images name a version
resources.staging-single     Resources   warn                      Staging needs one instance
promotion.checked-deploy     Promotion   always                    Promote the deploy that was checked
...
```

## Modes

| Mode | What happens |
| --- | --- |
| `enforce` | The action is refused, with the rule's message |
| `warn` | The action goes ahead. The rule's message is kept in the audit log (`policy_warnings`), and a resource plan shows it among its warnings |
| `off` | The rule is not checked |

An admin sets a rule's mode:

```sh
forge policy set images.pinned-version --mode warn
forge policy set images.pinned-version --mode enforce      # back to the default
forge policy set resources.production-ha --mode off --dry-run
```

Every change is in the audit log (`rule.update`). In the dashboard, the
**Rules** page lists the rules by kind, with a switch for admins.

## The Rules You Can Switch

| Rule | Checks | Default |
| --- | --- | --- |
| `images.pinned-version` | An image names a version, not `latest` or no tag | enforce |
| `images.allowed-registries` | Images come from the registries the platform allows | enforce |
| `charts.allowed-repos` | Charts come from the repositories the platform allows | enforce |
| `promotion.healthy-staging` | Staging is Synced and Healthy before it is promoted | enforce |
| `resources.storage-limit` | A database's storage is within its environment's limit | enforce |
| `resources.production-ha` | A production database runs at least 2 instances | enforce |
| `resources.instance-limit` | A database runs at most the platform's limit of instances | enforce |
| `resources.staging-single` | A staging database runs one instance | warn |

## The Rules That Are Always Enforced

These guard Forge and every team on it, so no one can switch them:

- A plan changes only the service's declared database, in its own
  namespace, exactly as forge.yaml says, with every change readable.
- A plan deletes a database only with `--allow-destroy`, and storage never
  shrinks; volumes use retained storage.
- An image built by another service's CI is deployed from that service's
  repo, never run as a different service.
- A registry or chart host that is an address or a one-word name (inside the
  platform's network) runs only when the platform allows it by name.
- A promotion ships the deploy that was checked: staging must run its latest
  deploy.
- An infrastructure repo deploys only to a target of its team, with the
  environment it asks for and room for it.

If Forge cannot read the modes, every switchable rule is enforced. Each
audit event of an action Forge checked says which modes differed from the
defaults (`policy_modes`).

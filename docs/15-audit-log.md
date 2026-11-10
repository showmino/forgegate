---
sidebar_position: 16
---

# Audit Log

Every write call to the Forge API is recorded, refused calls and dry runs
included. Each event names who made it, the action, the service, the target
and the result. Long-running work adds a second row with its outcome
(marked `↳`). Every member can read the log; nothing can change it.

## Common Questions

```sh
# What happened to payments this week?
forge audit list --service payments --since 7d

# What did Ana do that failed?
forge audit list --actor ana@example.com --failed

# Every production promotion, for a script
forge audit list --action deploy.promote -o json

# What did CI deploy?
forge audit list --actor my-org/payments

# What did forge-api do on its own?
forge audit list --actor system

# A window of time
forge audit list --since 2026-10-15T08:00:00Z --until 2026-10-15T12:00:00Z

# One event in full
forge audit get 1234
```

| Flag | Meaning |
| --- | --- |
| `--service` | Only events about this service |
| `--actor` | An email, a CI repo `<org>/<repo>`, `system` or `anonymous` |
| `--action` | For example `deploy.start`, `deploy.promote`, `service.address` |
| `--failed` | Only events whose result is not ok |
| `--since`, `--until` | A duration back from now (`24h`, `7d`) or an RFC 3339 time |
| `--limit` | The most events to show (default 50) |

## Is Forge Used?

```sh
forge audit adoption            # the last 30 days, and the 30 before
forge audit adoption --weekly   # the last 12 weeks
```

```text
              LAST 30 DAYS    30 DAYS BEFORE
people        5               4
deploys       42              30
self-served   75% (15 of 20)  60% (6 of 10)
```

- **people**: everyone who changed something through Forge.
- **deploys**: deploys, promotions and rollbacks started, by people and by CI.
- **self-served**: the share of people's changes made by members outside the
  admin groups. Each event records the person's role as the detail `role`
  (`admin` or `member`) since Forge 0.54.0; older changes do not count here.

Dry runs and refused calls do not count. The numbers are at most five
minutes old. In the dashboard, the **Adoption** page shows them with what is
stuck (teams with no service, failing services, services off the golden
path, teams without on-call, resources not ready) and the last 12 weeks.

## In the Dashboard

The Audit log page has the same filters.

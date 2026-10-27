---
sidebar_position: 9
---

# Operations

Long-running work runs as an **operation** on the Forge API: creating or
destroying a preview, a deploy, a promotion, a rollback, a resource plan or
apply, deleting a service. Commands that start one watch it until it ends.
You can also leave it and come back.

## List

```sh
forge op list
forge op list --running
forge op list --target environments/pr-142 -o json
```

## Watch

```sh
forge op watch op_9f2c4a1b0c3d
forge op watch op_9f2c4a1b0c3d --timeout 5m
```

`watch` replays everything that already happened, then streams new events.

| Exit code | Meaning |
| --- | --- |
| 0 | The operation succeeded |
| 7 | It failed or was cancelled |
| 8 | `--timeout` passed. You stopped watching; the operation keeps running |

Pressing Ctrl-C stops watching, not the operation.

## Cancel

```sh
forge op cancel op_9f2c4a1b0c3d --yes
forge op cancel op_9f2c4a1b0c3d --yes --wait   # and watch until it has stopped
```

Work already done is undone where the kind of operation allows it. For
example, a cancelled preview create removes the preview. Cancelling a
finished operation changes nothing.

## How Long They Are Kept

Operations live in the API's memory for 24 hours, and are lost when forge-api
restarts. The [audit log](13-audit-log.md) keeps the outcome for good.

## In the Dashboard

The Operations page lists them, and each has a page that streams its progress.

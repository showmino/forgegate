# Runbook

What to do when forgegate breaks. Fill in what is true for this
service; a runbook is read under stress, so keep each step short.

## The site does not load

1. See what runs and whether Argo CD calls it healthy:

   ```sh
   forge deploy status forgegate
   ```

2. Ask its health endpoint, `/api/healthz`.
3. If a deploy broke it, go back to the one before:

   ```sh
   forge deploy rollback forgegate --env production
   ```

## Alerts

| Alert | What it means | What to do |
| --- | --- | --- |
| _none yet_ | | |

## Dashboards and logs

- _Where its metrics and logs are._

## Who to ask

platform-engineering, the owning team.

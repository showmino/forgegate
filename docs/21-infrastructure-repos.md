---
sidebar_position: 15
---

# Infrastructure Repos

An infrastructure repo holds infrastructure code, Bicep or OpenTofu, that its
own GitHub Actions deploy to a cloud account. Forge makes the repo from a
template and sets up everything around it: the GitHub environments, the
account's secrets, and the cloud's trust in the repo's workflow. Production
runs wait for an approval in Forge by the team that owns the repo.

Forge never deploys such a repo itself, and it has no previews.

Your platform team decides which **targets** exist. A target is a set of cloud
accounts, one per environment: for example an Azure subscription for staging
and another for production. Ask them which targets your team may use.

## Create One

```sh
forge create infra-network --template opentofu --target azure --team platform
```

- `--template` is an infrastructure template, such as `opentofu` or `bicep`
  (`forge template list` shows the type of each).
- `--target` is where it deploys.
- `--environments staging,production` picks the environments. The default is
  every environment the target has. `--environments production` makes a repo
  with production only.

Forge then:

1. Creates the repo from the template and gives your team access.
2. Makes the repo's workflow tokens name the shared deploy workflow, so the
   cloud trusts only that workflow.
3. Sets up a GitHub environment for each environment you chose, with the
   account's values as environment secrets and variables. Production only
   accepts runs from `main`.
4. Lets the shared workflow sign in to each account.

`forge service get infra-network` shows the target and the environments.
Forge refuses a target your team may not use, an environment the target does
not have, and a target that is full. The refusal names the reason.

## What Is in the Repo

```text
.github/workflows/deploy.yml   calls the shared workflow
CODEOWNERS                     your team owns everything
forge.yaml                     infrastructure.tool: opentofu or bicep
README.md
infrastructure/terraform/      (or infrastructure/bicep/) your code
```

`forge.yaml` names the tool only. It cannot change the target or the
environments: those are kept by Forge.

## Deploy to Production

1. Open a pull request. The workflow checks the code and, if the repo has
   staging, shows the plan against staging.
2. Merge it. The workflow deploys to staging (if the repo has it), then asks
   Forge for production's approval:

   ```text
   approvals/apr_3950f08e3db4a99f asks team platform to approve 1a2b3c4 in production
   ```

3. Someone else on your team approves it:

   ```sh
   forge approval list --state pending
   forge approval get apr_3950f08e3db4a99f
   forge approval approve apr_3950f08e3db4a99f --reason 'plan reviewed'
   ```

   Forge then starts the repo's production run, which deploys that commit.

The person who pushed the commit, or who re-ran the job, cannot approve it:

```text
you started this run, so another member of team platform must approve it
```

`forge approval reject <id> --reason ...` turns it down.

Only the newest commit can deploy. A newer push supersedes an approval that is
still waiting, or approved but not deployed yet. If the branch moved on after
an approval, the production run refuses to deploy the older commit, and the
newest commit asks for its own approval.

If Forge could not start the run, `forge approval approve` says so and keeps
the approval. Run the same command again to retry.

## A Team of One

A team with one member cannot get a second approver. Ask the platform team for
an exception:

```sh
forge approval exception request infra-network --reason 'I am the only one on the team'
```

This opens a pull request in the deploy repo. Once a platform team member
other than you approves it and squash-merges it, your team may approve its
own production runs of that repo. Forge checks the pull request and the
approval on GitHub each time, so a file that got there some other way does not
count.

```sh
forge approval exception list
forge approval exception revoke infra-network --reason 'Bo joined the team'
```

`list` shows each exception and whether it holds; if it does not, it says why.

## For the Platform Team

Infrastructure repos are off until you set `infrastructure.*` in the chart
(see [Chart Values](19-chart-values.md#infrastructure-repos)). You also need:

- Crossplane, with its GitHub provider (a `ProviderConfig` or
  `ClusterProviderConfig` for your organization) and a provider for each cloud
  your targets use. For Azure that is `provider-azure-managedidentity`, whose
  identity may only edit the targets' identities.
- A Kubernetes Secret per target environment in `infrastructure.namespace`,
  with the values the target's `githubSecrets` name.
- The shared workflow, in a repository your organization's repos may call
  workflows from (`infrastructure.workflow`).
- The GitHub App's **Actions: write**, for the repo's OIDC setting and to start
  production runs.
- For exceptions: admin groups that are GitHub teams (`--admin-groups
  my-org:platform`), and in the deploy repo a `CODEOWNERS` entry and a ruleset
  that require your team's review on `exceptions/`. Merge exception pull
  requests with squash.

For Azure, each environment's managed identity holds at most 20 federated
credentials, so a target environment takes about 20 repos (`maxRepos`). OpenTofu
keeps its state in a storage account the identity can write blobs to (Storage
Blob Data Contributor): Owner alone gives no data access.

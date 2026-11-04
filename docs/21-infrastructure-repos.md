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
PR plans and what-if checks inspect existing accounts; they do not create
preview environments.

Your platform team decides which **targets** exist. A target is a set of cloud
accounts, one per environment: for example an Azure subscription for staging
and another for production. Ask them which targets your team may use.

## Create One

```sh
forge create infra-network --template opentofu --target azure --team platform
```

- `--template` is an infrastructure template, such as `opentofu` or `bicep`
  (`forge template list` shows the type of each).
- `--target` is where it deploys. `forge template targets` lists the targets.
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
5. With repository protection enabled, requires a pull request for `main`
   and successful infrastructure PR checks, without administrator bypass.
   The owning team must approve the pull request; see
   [the owner team's access](12-catalog.md#the-owner-teams-access-to-the-repo)
   for how a reviewed alternate team can be used.

In the dashboard, pick the template on the Create page: it asks for the
target (only those open to your team) and the environments.

`forge service get infra-network`, and the repo's page in the dashboard, show
the target, the environments and any exception.
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

1. Open a pull request. The workflow checks the code and runs Terraform/OpenTofu
   plan or Bicep what-if against every account the repo uses. Production-only
   repos work too. Each PR uses a separate plan identity, not the deployment
   identity, and creates no environments or resources. All checks must succeed
   before merging; keep the branch up to date with `main`.
2. Merge it. The workflow deploys to staging (if the repo has it), then asks
   Forge for production's approval:

   ```text
   approvals/apr_3950f08e3db4a99f asks team platform to approve 1a2b3c4 in production
   ```

3. Someone else on your team approves it, on the dashboard's **Approvals**
   page or with the CLI:

   ```sh
   forge approval list --state pending
   forge approval get apr_3950f08e3db4a99f
   forge approval approve apr_3950f08e3db4a99f --reason 'plan reviewed'
   ```

   Forge then starts the repo's production run, which deploys that commit.

Bicep uses `Azure/bicep-deploy@v2.5.0` for what-if and deployment. Deployments
use Azure deployment stacks with `delete` for unmanaged resources and
resource groups and `denyDelete` for managed resources. **Removing a resource
from your template can delete it during the next approved deployment.**
The deny setting prevents ordinary direct deletion of managed resources; it
does not prevent the stack from removing resources as configured.
PR what-if uses ARM deployment what-if with read-only validation, not stack
what-if. It does not show stack unmanage deletions, so review resources
removed from the template as well as the what-if output.

Terraform/OpenTofu PR plans read a state snapshot into a local backend without
locking or initializing remote state. A missing blob means no prior deploy;
other storage failures stop the plan. Deployment replans and acquires the
state lock after merge, so a PR plan is not a saved apply authorization.

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
- A separate `plan` identity and Secret for each target environment. PRs run
  unreviewed code: never reuse a deployment identity. Its `githubSecrets`,
  `githubVariables` and `access` follow the same shape as deployment settings.
  Crossplane creates repository-level `FORGE_PLAN_<ENV>_*` settings, not a
  GitHub environment. Its federated subject is the shared workflow's PR
  subject, ending in `:pull_request`.
- The shared workflow, in a repository your organization's repos may call
  workflows from (`infrastructure.workflow`).
- The GitHub App's **Actions: write**, for the repo's OIDC setting and to start
  production runs.
- `repositories.enabled: true`, Crossplane's namespaced GitHub
  `RepositoryRuleset` CRD, and a GitHub provider with repository
  administration access. Main requires PRs, without App or administrator
  bypass. Existing audited Forge-created repos are included; connected repos
  are not adopted. Removing a catalog entry does not remove protection.
- For exceptions: admin groups that are GitHub teams (`--admin-groups
  my-org:platform`), and in the deploy repo a `CODEOWNERS` entry and a ruleset
  that require your team's review on `exceptions/`. Merge exception pull
  requests with squash.

For Azure, each environment's managed identity holds at most 20 federated
credentials, so a target environment takes about 20 repos (`maxRepos`). OpenTofu
keeps its state in a storage account the identity can write blobs to (Storage
Blob Data Contributor): Owner alone gives no data access.

The Azure **plan** identity instead needs Reader on the resources it plans,
ARM `Microsoft.Resources/deployments/whatIf/action` and
`Microsoft.Resources/deployments/validate/action`, and Storage Blob Data Reader
on the `tfstate` container. Bicep what-if uses `providerNoRbac` validation;
Terraform/OpenTofu PR plans use `-lock=false`, so no state write or lease
permission is granted. Do not assign Contributor or Owner to this identity.
Its Azure federated credentials also have the 20-per-identity limit; keep
the target's `maxRepos` within the capacities of both identities.

Roll out the plan settings and shared workflow before making PR checks
required. Existing repos whose workflows do not call the shared workflow
need a workflow PR first. Targets without plan access refuse new creates.
Existing repositories without a successful template-create audit record
cannot be safely distinguished from connected repos: inventory and adopt
their rulesets explicitly rather than assuming ownership.

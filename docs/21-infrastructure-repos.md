---
sidebar_position: 15
---

# Infrastructure Repos

An infrastructure repo holds infrastructure code, such as Bicep, OpenTofu or
Terraform, that its GitHub Actions deploy to a configured cloud target. Forge
creates the repo and coordinates its GitHub environments, workflow access and
production approval. The target integration and shared workflow determine how
cloud access and deployment are set up.
The platform must provide templates and a shared workflow for the providers
and tools it offers.

Forge does not deploy infrastructure itself or create preview environments.
Pull-request plans and what-if checks inspect the configured targets; they do
not apply changes.

Your platform team defines which **targets** exist and which teams may use
them. A target can use whatever scope fits its provider and deployment model:
for example, a resource group, subscription, cloud account or project. The
provider integration can use an existing scope or provision one for a service
environment. Forge does not require resource groups.

## Create One

```sh
forge template targets
forge create infra-network --template opentofu --target my-cloud --team platform
```

Replace `my-cloud` and `platform` with a target and team available in your
Forge installation.

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
3. Sets up a GitHub environment for each environment you chose, with that
   environment's configured values as secrets and variables. Production only
   accepts runs from `main`.
4. Configures the provider access for each chosen environment. Depending on
   the platform integration, this may provision a new scope or grant access
   to an existing one. Forge does not prescribe the cloud resource boundary.
5. Lets the shared workflow sign in to each service environment.
6. With repository protection enabled, requires a pull request for `main`
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

1. Open a pull request. The workflow checks the code and runs a Terraform/OpenTofu
   plan or Bicep what-if against every configured target environment. Production-only
   repos work too. Each PR uses a separate plan identity, not the deployment
   identity, and creates no environments or resources. All checks must succeed
   before merging; keep the branch up to date with `main`.
2. Merge it. The workflow deploys to staging (if the repo has it), then asks
   Forge for production's approval:

   ```text
   approvals/apr_3950f08e3db4a99f asks team platform to approve 1a2b3c4 in production
   ```

3. Someone else on your team approves it, on the dashboard's **Approvals**
   page or with the CLI. Your team sees it waiting without looking for it: the
   dashboard's Overview lists it under **Needs attention** ("Production of
   infra-network waits for your team's approval"), and the sidebar shows how
   many runs wait beside **Approvals**. A run you started yourself is listed
   too, though someone else has to approve it unless your team has an
   exception or your Forge allows self-approval (see below).

   ```sh
   forge approval list --state pending
   forge approval get apr_3950f08e3db4a99f
   forge approval approve apr_3950f08e3db4a99f --reason 'plan reviewed'
   ```

   Forge then starts the repo's production run, which deploys that commit.

The shared workflow and template define provider-specific validation,
planning, state storage and deployment behavior. Configure pull-request
credentials with read-only access, separate from deployment credentials. The
merge-time deployment should plan again with its deployment access; a
pull-request plan is not authorization to apply a saved plan. Review the
provider's deletion and lifecycle behavior along with the plan output and
template diff before merging.

The person who pushed the commit, or who re-ran the job, cannot approve it:

```text
you started this run, so another member of team platform must approve it
```

If your Forge is set up with `infrastructure.allowSelfApproval: true`, this
rule is off: any member of the owning team may approve, including the person
who pushed or re-ran. Ask your platform team which applies.

`forge approval reject <id> --reason ...` turns it down.

Only the newest commit can deploy. A newer push supersedes an approval that is
still waiting, or approved but not deployed yet. If the branch moved on after
an approval, the production run refuses to deploy the older commit, and the
newest commit asks for its own approval.

If Forge could not start the run, `forge approval approve` says so and keeps
the approval. Run the same command again to retry.

## A Team of One

A team with one member cannot get a second approver. (Not needed when your
Forge has `infrastructure.allowSelfApproval` on; see above.) Ask the platform
team for an exception:

```sh
forge approval exception request infra-network --reason 'I am the only one on the team'
```

This opens a pull request in the deploy repo. Once a platform team member
other than you approves it and squash-merges it, your team may approve its
own production runs of that repo. Forge checks the pull request and the
approval on GitHub each time, so a file that got there some other way does not
count. While the exception is active, pull requests to that service still
require a pull request and all required checks, but no approving review. The
exception grant and revocation are themselves reviewed pull requests; revoking
the exception restores the normal review requirement.

```sh
forge approval exception list
forge approval exception revoke infra-network --reason 'Bo joined the team'
```

`list` shows each exception and whether it holds; if it does not, it says why.

In the dashboard, open the repo's page: its Infrastructure section shows the
exception, and members of the owning team (and admins) see **Ask for an
exception**, or **Revoke exception** when the repo has one. The dialog asks for
the reason and links the pull request Forge opens. The Approvals page lists
every exception, with **Revoke** for the teams that may revoke it.

## For the Platform Team

Infrastructure repos are disabled by default. To enable them, configure
`infrastructure.enabled`, at least one target, and the shared workflow in the
chart; see [Chart Values](19-chart-values.md#infrastructure-repos).

For each target, configure the environments, teams, GitHub settings and
provider access. The access integration determines the deployment boundary:
it can use an existing scope or provision a scope such as a resource group,
subscription, account or project. Configure the shared workflow and templates
to sign in to that provider and deploy with the selected tool. Forge does not
require a particular cloud provider or resource hierarchy.

Keep the deployment and plan identities outside the scope they deploy to, and
give them roles on that scope only. A role that can write in the scope must
not be able to change the identity's own trust. On Azure, for example,
Contributor on a resource group can add federated credentials to the
identities in it, so code deployed with that identity could sign in without
Forge's approval. Put the identities in a separate resource group where they
have no role, and have the templates reference the service's resource group
as an existing one (`data "azurerm_resource_group"` in OpenTofu, an
`existing` resource group in Bicep) rather than declare it.

Configure a separate, least-privilege plan identity for pull-request code;
never reuse deployment credentials. Enable repository protection and require
the infrastructure PR check before merges. Ensure the shared workflow reports
that check and that branch protection and the workflow are ready before making
it required.

The GitHub App needs **Actions: write** for the repository's OIDC settings and
to start production runs. To support team-of-one exceptions, configure Forge's
admin groups and require the platform team's review for exception changes in
the deploy repo.

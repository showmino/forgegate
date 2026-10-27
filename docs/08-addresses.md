---
sidebar_position: 9
---

# Addresses and Visibility

Every service gets an address in staging and in production. Where the
platform offers public domains, you choose whether each one is on the internet
or only internal.

## Where to Find a Service

```sh
forge service address payments     # staging and production addresses
forge deploy status payments       # the URL column
```

## Internal Addresses

Every service has an internal address under the cluster's apps domain (the
chart's `apps.domain`, here `apps.example.com`):

| Environment | Address |
| --- | --- |
| Production | `http://payments.production.apps.example.com` |
| Staging | `http://payments.staging.apps.example.com` |

The platform team points `*.production.<apps domain>` and
`*.staging.<apps domain>` at the cluster's Gateway or ingress controller, so
who can reach these addresses is their choice, usually a private network.
Forge shows them as `http://`, even when the ingress controller adds a
certificate.

If the platform offers no public domains (`forge domain list` is empty, as
with the Helm chart), this is the only address a service has, and the rest of
this page does not apply.

## Public Domains: the Three Choices

Where the platform offers public domains, a service chooses:

| Who can reach it | Production | Staging | forge.yaml |
| --- | --- | --- | --- |
| **Public** (default) | `https://payments.example.com` | `https://payments-staging.example.com` | nothing |
| **Internal staging** | `https://payments.example.com` | `http://payments.staging.apps.example.com` | `run.staging.public: false` |
| **Internal** | `http://payments.production.apps.example.com` | `http://payments.staging.apps.example.com` | `run.domain: none` |

- **Public** addresses use HTTPS. Forge makes the DNS record with the
  deployment.
- **Internal** addresses are the ones above. Use them for internal tools, and
  for APIs that only other services call.
- **Internal staging** is for testing a release privately before it goes
  out: staging is internal, production is public.

Public domains need more than the Helm chart installs: the API's
`--public-domains` setting, and a way to make DNS records and carry the
traffic (Forge's own install uses Cloudflare and a Cloudflare tunnel).

For a new service, pick it at create time with `forge create ... --internal-staging`
or `--internal`, and the domain with `--domain`. For an existing one, edit forge.yaml:

```yaml
run:
  staging:
    public: false       # Internal staging
```

```yaml
run:
  domain: none          # Internal
```

A change applies at the next deploy (staging) or promote (production). The
deploy says so, and names the old address that stops working.

## Another Name or Another Domain

```yaml
run:
  host: shop                # shop.example.org and shop-staging.example.org
  domain: example.org       # another of the platform's public domains
```

- `forge domain list` shows the platform's public domains, the default
  first. A new service can pick one with
  `forge create ... --domain <domain>`.
- Addresses have one label under the domain (`shop.example.com`, never
  `a.shop.example.com`), because the certificate covers only that.
- `run.host` cannot be the name of another service in the catalog.
- A new address must not resolve in DNS yet. Forge refuses a name that is in
  use before it writes anything.
- A service whose name ends in `-staging` gets no public address, because that
  would be another service's staging address.

## The Domain Itself (example.com)

To serve a service at the bare domain, set its address in Forge. forge.yaml
cannot say `@`. This is for the rare move, and only admins may do it.

```sh
forge service address website --host @ --domain example.com --dry-run
forge service address website --host @ --domain example.com --claim example.com
forge service address website --clear      # back to forge.yaml's run.host and run.domain
```

- With `--host @`, production is at `https://example.com` and staging at
  `https://staging.example.com`.
- An address that already resolves (because something else serves it) is only
  taken over when you name it with `--claim`. The claim is recorded in the
  audit log.
- Forge makes no DNS record for the root of a domain. Whoever owns the domain
  points it at the cluster.
- The setting in Forge wins over forge.yaml until `--clear`.
- You must type the service's name to confirm, or pass `--yes`.

In the dashboard: the service's Settings, Danger zone, Change address.

## Previews

Preview environments always have an internal address. See
[Preview environments](10-preview-environments.md).

## When an Address Does Not Answer

| What you see | Likely cause |
| --- | --- |
| Cloudflare error 530 (with Cloudflare) | No route for that name: the service moved, its staging is internal, or it was never deployed there |
| The old address stopped working after a deploy | Expected: the deploy moved it. `forge service address <svc>` shows the new one |
| Deploy refused: the name resolves | The address is in use. Choose another `run.host`, or `--claim` it with `forge service address` |
| Internal address times out | You are not on the network the apps domain is reached from |

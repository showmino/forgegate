---
sidebar_position: 11
---

# Service Docs

A service's docs are Markdown files under `docs/` in its own repo, with
`docs/index.md` as the start page. Forge reads them from the default branch
as they are now. Nothing is built or published, so a merged change shows up
within a minute.

## Read Docs

```sh
forge docs list                              # services that have docs
forge docs get payments                      # the start page
forge docs get payments runbook.md           # a page, by its path under docs/
forge docs get payments --pages              # the pages, in menu order
forge docs get payments api/errors.md -o json | jq -r .editUrl
```

In the dashboard: the Docs page, and the Docs tab of a service.

## Search Docs

```sh
forge docs search restart queue              # every service's docs
forge docs search --service payments refund  # one service's
```

A page matches when it holds every word, in its title or anywhere in its
text, in any case. Pages with the words in their title come first. Each
result shows the first line that holds a word (`-o json` shows up to three).
In the dashboard, type in the box on the Docs page: it narrows the services
by name or team, and from two letters it searches every page too. The search
box at the top of every page (Ctrl+K or ⌘K) does the same next to services,
templates and pages: its last row, "Search all docs", opens every result on
the Docs page.

A page merged a minute ago is found: the search checks with GitHub first.

## Write Docs

```text
payments/
├── docs/
│   ├── index.md          # required: the start page
│   ├── runbook.md
│   ├── images/flow.png
│   └── api/
│       └── errors.md
└── forge.yaml
```

- Start every page with one `#` heading. It is the page's title.
- Link between pages with relative paths that include `.md`:
  `[Runbook](runbook.md)`, `[Errors](api/errors.md)`.
- Images go next to the pages and are linked the same way.
- YAML front matter (`--- ... ---` at the top) is allowed and is not shown.

## Draw Diagrams

A fenced block marked `mermaid` is drawn as a diagram in the dashboard:

````md
```mermaid
flowchart LR
  checkout --> payments --> ledger
```
````

The diagram is shown as a picture: labels are plain text, and links or
click actions in it do nothing. A diagram Mermaid cannot read shows its
source with Mermaid's message, so check it in the
[Mermaid live editor](https://mermaid.live) when that happens. On GitHub
the same block is drawn too.

## Set the Order

Without a list, pages are in alphabetical order (number them `01-`, `02-`
to choose). With one, forge.yaml sets the order and titles:

```yaml
docs:
  - path: index.md
  - path: runbook.md
    title: Runbook
  - path: api/errors.md
```

Pages not listed come after, in alphabetical order.

## Check Before You Push

```sh
forge docs lint
forge docs lint ../payments -o json | jq -r '.findings[].message'
```

This needs no login. It checks that:

- `docs/index.md` exists,
- every page forge.yaml lists exists,
- links and images point at files that exist,
- pages and images are within the limits.

| Limit | Value |
| --- | --- |
| One page | 1 MiB |
| One image | 5 MiB |
| Pages per service | 500 |
| All pages together | 32 MiB |

It exits 0 when there are no problems and 1 when there are.

# forgegate

What forgegate is, in a sentence or two: who uses it and what for.
These docs live in `docs/` next to the code; Forge shows them in its
dashboard, a minute after they reach `main`.

| | |
| --- | --- |
| Owner | platform-engineering |
| Repository | <https://github.com/showmino/forgegate> |
| Stack | Next.js with TypeScript and Tailwind CSS |
| Started from | the `nextjs` template, v1.7.0 |

## Run it locally

```sh
npm ci
npm run dev        # http://localhost:3000
npm run lint && npm run typecheck && npm test
```

## How it ships

CI tests every push. On `main` it builds an image and deploys it to staging
through Forge, as a release candidate. Production is a promote:

```sh
forge deploy status forgegate
forge deploy promote forgegate
forge env create <name> --service forgegate --ref <branch>   # a preview
```

## More

- [Runbook](runbook.md): what to do when it breaks.

Add pages next to these. `forge docs lint` checks them before a push, and an
optional `docs:` list in `forge.yaml` sets their order and titles.

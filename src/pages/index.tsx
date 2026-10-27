import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import CodeBlock from '@theme/CodeBlock';
import styles from './index.module.css';

const features: {title: string; text: string}[] = [
  {
    title: 'New services from templates',
    text: 'forge create makes the repo with CI, a Dockerfile, tests, docs and a forge.yaml that works. The first push deploys to staging.',
  },
  {
    title: 'One small file per service',
    text: 'forge.yaml says what a service needs: its port, health check, address and a few run options. Everything else is the platform’s decision.',
  },
  {
    title: 'Staging, production and previews',
    text: 'CI deploys main to staging with its own GitHub identity, and no secret. A person promotes it to production. Any branch can run as a preview.',
  },
  {
    title: 'Releases and rollbacks',
    text: 'Every staging deploy is a release candidate and every promotion a release, tagged on the commit. A bad release rolls back in one command.',
  },
  {
    title: 'GitOps underneath',
    text: 'Forge writes what should run to a deploys repo and Argo CD applies it. Every change is a commit you can read and undo.',
  },
  {
    title: 'Who did what',
    text: 'GitHub teams decide who may change which service. Every change, refused attempts included, is in the audit log.',
  },
];

const install = `# apps/forge.yaml in the repo Argo CD reads
kind: Application
metadata: {name: forge, namespace: argocd}
spec:
  source:
    repoURL: oci://ghcr.io/showmino/charts/forge
    targetRevision: 0.29.0   # an upgrade is a commit
    path: .
    helm:
      valuesObject:
        github: {org: my-org, appID: "123456"}
        host: forge.example.com
  destination: {namespace: forge, server: https://kubernetes.default.svc}`;

const cli = `# from your Forge, so the CLI matches its API
curl -fLo forge https://forge.example.com/cli/forge-linux-amd64
install -m 0755 forge ~/.local/bin/forge
forge context set my-org --api https://forge.example.com --use
forge auth login`;

const use = `forge create payments --template hello --team billing
git push                              # CI deploys main to staging
forge deploy promote payments --yes   # production, tagged v1.0.0`;

const steps: {title: string; text: ReactNode; code: string; lang: string; link: string; linkText: string}[] = [
  {
    title: '1. Install Forge on Kubernetes',
    text: 'From code: an Argo CD Application in your Git repo installs the API, the dashboard, the login through your GitHub App, and a database. Every change after that, upgrades included, is a commit.',
    code: install,
    lang: 'yaml',
    link: '/docs/running-your-own-forge',
    linkText: 'Install Forge, step by step',
  },
  {
    title: '2. Install the CLI',
    text: 'Once the API is live, it serves the CLI of its own version. Point it at your Forge and sign in with GitHub.',
    code: cli,
    lang: 'bash',
    link: '/docs/install-and-login',
    linkText: 'Install the CLI and log in',
  },
  {
    title: '3. Create services',
    text: 'Start your templates from the example, then create a service from one. Every page of the dashboard shows the command that does the same thing.',
    code: use,
    lang: 'bash',
    link: '/docs/write-your-templates',
    linkText: 'Write your templates',
  },
];

export default function Home(): ReactNode {
  return (
    <Layout
      title="An internal developer platform for your GitHub organization"
      description="Forge makes services from templates, keeps the catalog, deploys to staging and production through Argo CD, and records who did what.">
      <header className={styles.hero}>
        <div className="container">
          <h1 className={styles.title}>Ship services without knowing the cluster.</h1>
          <p className={styles.lead}>
            Forge is an internal developer platform for your GitHub organization. Teams describe a service in a short
            forge.yaml; Forge creates it, deploys it to staging and production through Argo CD, versions every release
            and records who did what.
          </p>
          <div className={styles.actions}>
            <Link className="button button--primary button--lg" to="/docs/running-your-own-forge">
              Install Forge
            </Link>
            <Link className="button button--secondary button--lg" to="/docs/what-is-forge">
              What is Forge
            </Link>
          </div>
        </div>
      </header>
      <main>
        <section className="container">
          <div className={styles.features}>
            {features.map((f) => (
              <div key={f.title} className={styles.feature}>
                <h2 className={styles.featureTitle}>{f.title}</h2>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="container">
          <h2 className={styles.stepsTitle}>Get started</h2>
          <div className={styles.steps}>
            {steps.map((step) => (
              <div key={step.title} className={styles.step}>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
                <CodeBlock language={step.lang}>{step.code}</CodeBlock>
                <Link to={step.link}>{step.linkText}</Link>
              </div>
            ))}
          </div>
        </section>
      </main>
    </Layout>
  );
}

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

const install = `kubectl create namespace forge
kubectl -n forge create secret generic forge-github \\
  --from-file=app-private-key=my-app.private-key.pem \\
  --from-literal=client-id=<client ID> --from-literal=client-secret=<client secret>
helm install forge oci://ghcr.io/showmino/charts/forge -n forge -f forge-values.yaml`;

const use = `forge create payments --template go-grpc --team billing
git push                              # CI deploys main to staging
forge deploy promote payments --yes   # production, tagged v1.0.0`;

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
          <div className={styles.split}>
            <div>
              <h2>Run it on your cluster</h2>
              <p>
                One Helm chart: the API, the dashboard, the login through your GitHub App, and a database. Add Argo CD for
                deploys and any ingress controller or Gateway.
              </p>
              <CodeBlock language="bash">{install}</CodeBlock>
              <Link to="/docs/running-your-own-forge">Install Forge, step by step</Link>
            </div>
            <div>
              <h2>Use it from the CLI or the dashboard</h2>
              <p>
                Everything is a <code>forge</code> command, and every page of the dashboard shows the command that does the
                same thing.
              </p>
              <CodeBlock language="bash">{use}</CodeBlock>
              <Link to="/docs/create-a-service">Create a service</Link>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}

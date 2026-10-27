import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// "Get started" is the order a new install follows: Forge on Kubernetes
// first, then the CLI against the live API, then templates and services. The
// ids are the file names in docs/ without their number prefix, and the
// numbers follow this order too.
const sidebars: SidebarsConfig = {
  docs: [
    'index',
    {
      type: 'category',
      label: 'Get started',
      collapsed: false,
      items: ['what-is-forge', 'running-your-own-forge', 'install-and-login', 'write-your-templates', 'create-a-service'],
    },
    {
      type: 'category',
      label: 'Use Forge',
      collapsed: false,
      items: [
        'bring-an-existing-repo',
        'forge-yaml',
        'deploy-and-release',
        'addresses',
        'run-options',
        'preview-environments',
        'operations',
        'catalog',
        'service-docs',
        'resources',
        'audit-log',
        'templates',
        'scripting-and-troubleshooting',
        'command-reference',
      ],
    },
    {
      type: 'category',
      label: 'Run Forge',
      collapsed: false,
      items: ['chart-values', 'cluster-capacity'],
    },
  ],
};

export default sidebars;

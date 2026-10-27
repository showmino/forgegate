import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// Two parts: using a Forge, and running one. The ids are the file names in
// docs/ without their number prefix.
const sidebars: SidebarsConfig = {
  docs: [
    'index',
    {
      type: 'category',
      label: 'Use Forge',
      collapsed: false,
      items: [
        'what-is-forge',
        'install-and-login',
        'create-a-service',
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
      items: ['running-your-own-forge', 'write-your-templates', 'chart-values', 'cluster-capacity'],
    },
  ],
};

export default sidebars;

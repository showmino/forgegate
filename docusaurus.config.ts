import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// forgegate.io: Forge's landing page at / and its documentation under /docs.
// The pages in docs/ are plain Markdown (markdown.format "detect"), because
// Forge's dashboard renders the same files in its Docs tab.

const config: Config = {
  title: 'Forge',
  tagline: 'An internal developer platform for your GitHub organization',
  favicon: 'img/favicon.svg',

  future: {
    v4: true,
  },

  url: 'https://forgegate.io',
  baseUrl: '/',
  trailingSlash: false,

  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',
  markdown: {
    format: 'detect',
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          path: 'docs',
          routeBasePath: 'docs',
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/showmino/forgegate/edit/main/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themes: [
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        indexBlog: false,
        docsRouteBasePath: '/docs',
        highlightSearchTermsOnTargetPage: true,
      },
    ],
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'forge',
      logo: {
        alt: 'Forge',
        src: 'img/logo.svg',
        srcDark: 'img/logo-dark.svg',
        width: 26,
        height: 26,
      },
      items: [
        {type: 'docSidebar', sidebarId: 'docs', position: 'left', label: 'Docs'},
        {to: '/docs/running-your-own-forge', label: 'Install', position: 'left'},
        {href: 'https://github.com/showmino/forge', label: 'GitHub', position: 'right'},
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'What is Forge', to: '/docs/what-is-forge'},
            {label: 'Install Forge', to: '/docs/running-your-own-forge'},
            {label: 'Command reference', to: '/docs/command-reference'},
          ],
        },
        {
          title: 'Code',
          items: [
            {label: 'Forge', href: 'https://github.com/showmino/forge'},
            {label: 'Releases', href: 'https://github.com/showmino/forge/releases'},
            {label: 'Example templates', href: 'https://github.com/showmino/forge-example-templates'},
          ],
        },
      ],
      copyright: `Forge, by showmino. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'yaml', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;

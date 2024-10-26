const lightCodeTheme = require("prism-react-renderer/themes/github");
const darkCodeTheme = require("prism-react-renderer/themes/oceanicNext");

// With JSDoc @type annotations, IDEs can provide config autocompletion
/** @type {import('@docusaurus/types').DocusaurusConfig} */
(
    module.exports = {
        title: "Pektin",
        tagline: "is a strongly opinionated DNS server",
        url: "https://pektin.y.gy.",
        baseUrl: "/docs/",
        baseUrlIssueBanner: false,
        onBrokenLinks: "throw",
        onBrokenMarkdownLinks: "warn",
        favicon: "img/logo.svg",
        organizationName: "Pektin",
        projectName: "Pektin",
        trailingSlash: false,

        presets: [
            [
                "@docusaurus/preset-classic",
                /** @type {import('@docusaurus/preset-classic').Options} */
                ({
                    docs: {
                        sidebarPath: require.resolve("./sidebars.js"),
                        routeBasePath: "compose",
                        path: "docs/compose",
                        editUrl: "https://github.com/pektin-dns/pektin-docs/edit/main/"
                    },
                    theme: {
                        customCss: require.resolve("./src/css/custom.css")
                    }
                })
            ]
        ],
        plugins: [
            [
                "@docusaurus/plugin-content-docs",
                {
                    id: "helm",
                    path: "docs/helm",
                    routeBasePath: "helm",
                    sidebarPath: require.resolve("./sidebars.js")
                }
            ],
            [
                "@docusaurus/plugin-content-docs",
                {
                    id: "server",
                    path: "docs/server",
                    routeBasePath: "server",
                    sidebarPath: require.resolve("./sidebars.js")
                }
            ],
            [
                "@docusaurus/plugin-content-docs",
                {
                    id: "api-server",
                    path: "docs/api-server",
                    routeBasePath: "api-server",
                    sidebarPath: require.resolve("./sidebars.js")
                }
            ],
            [
                "@docusaurus/plugin-content-docs",
                {
                    id: "ui",
                    path: "docs/ui",
                    routeBasePath: "ui",
                    sidebarPath: require.resolve("./sidebars.js")
                }
            ],
            [
                "@docusaurus/plugin-content-docs",
                {
                    id: "certbot",
                    path: "docs/certbot",
                    routeBasePath: "certbot",
                    sidebarPath: require.resolve("./sidebars.js")
                }
            ],
            [
                "@docusaurus/plugin-content-docs",
                {
                    id: "ribston",
                    path: "docs/ribston",
                    routeBasePath: "ribston",
                    sidebarPath: require.resolve("./sidebars.js")
                }
            ],
            [
                "@docusaurus/plugin-content-docs",
                {
                    id: "vault",
                    path: "docs/vault",
                    routeBasePath: "vault",
                    sidebarPath: require.resolve("./sidebars.js")
                }
            ],
            [
                "@docusaurus/plugin-content-docs",
                {
                    id: "keydb",
                    path: "docs/keydb",
                    routeBasePath: "keydb",
                    sidebarPath: require.resolve("./sidebars.js")
                }
            ]
        ],

        themeConfig:
            /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
            ({
                navbar: {
                    title: "Pektin",
                    logo: {
                        alt: "Pektin Logo",
                        src: "img/logo.svg"
                    },
                    items: [
                        {
                            to: "compose/overview",
                            position: "left",
                            label: "Compose"
                        },
                        {
                            to: "helm/overview",
                            position: "left",
                            label: "Helm"
                        },
                        {
                            to: "#disabled",
                            position: "left",
                            label: "|"
                        },
                        {
                            to: "server/overview",
                            position: "left",
                            label: "Server"
                        },
                        {
                            to: "api-server/overview",
                            position: "left",
                            label: "API"
                        },
                        {
                            to: "ui/overview",
                            position: "left",
                            label: "UI"
                        },
                        {
                            to: "certbot/overview",
                            position: "left",
                            label: "Certbot"
                        },
                        {
                            to: "ribston/overview",
                            position: "left",
                            label: "Ribston"
                        },
                        {
                            to: "vault/overview",
                            position: "left",
                            label: "Vault"
                        },
                        {
                            to: "keydb/overview",
                            position: "left",
                            label: "Keydb"
                        }
                    ]
                },
                footer: {
                    style: "dark",
                    links: [
                        {
                            title: "Repos",
                            items: [
                                {
                                    href: "https://git.y.gy/pektin",
                                    label: "git.y.gy"
                                },
                                {
                                    href: "https://gitlab.com/pektin",
                                    label: "GitLab"
                                },
                                {
                                    href: "https://github.com/pektin-dns",
                                    label: "GitHub"
                                }
                            ]
                        },
                        {
                            title: "Docs",
                            items: [
                                {
                                    href: "https://pektin.gitlab.io/docs/",
                                    label: "GitLab"
                                },
                                {
                                    href: "https://pektin-dns.github.io/docs/",
                                    label: "GitHub"
                                }
                            ]
                        },
                        {
                            title: "Container Images",
                            items: [
                                {
                                    href: "https://hub.docker.com/repositories",
                                    label: "Docker Hub"
                                }
                            ]
                        }
                    ],
                    copyright: `Copyright ${new Date().getFullYear()} Paul, Max and the Pektin Contributors.`
                },
                prism: {
                    theme: lightCodeTheme,
                    darkTheme: darkCodeTheme
                }
            })
    }
);

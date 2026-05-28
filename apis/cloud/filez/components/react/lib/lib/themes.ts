import { defaultThemes, type MowsTheme } from "@my-own-web-services/react-components/lib/themes";

export { loadThemeCSS, type MowsTheme } from "@my-own-web-services/react-components/lib/themes";

export const themes: MowsTheme[] = [
    ...defaultThemes,
    {
        id: `neo-brutalist`,
        name: `Neo Brutalist`,
        url: `/themes/neo-brutalist.css`
    },
    {
        id: `neo-brutalist-dark`,
        name: `Neo Brutalist Dark`,
        url: `/themes/neo-brutalist-dark.css`
    }
];

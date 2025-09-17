export interface FilezTheme {
    readonly id: string;
    readonly name: string;
    readonly url?: string;
}

export const themes: FilezTheme[] = [
    {
        id: "system",
        name: "System"
    },
    {
        id: "light",
        name: "Light"
    },
    {
        id: "dark",
        name: "Dark"
    },
    {
        id: "neo-brutalist",
        name: "Neo Brutalist",
        url: "/themes/neo-brutalist.css"
    },
    {
        id: "neo-brutalist-dark",
        name: "Neo Brutalist Dark",
        url: "/themes/neo-brutalist-dark.css"
    }
];

export const themeLocalStorageKey = "filez_theme";
export const themePrefix = "filez-theme-";

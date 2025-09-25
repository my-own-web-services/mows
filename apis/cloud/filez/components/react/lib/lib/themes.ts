export interface FilezTheme {
    readonly id: string;
    readonly name: string;
    readonly url?: string;
}

export const loadThemeCSS = (href: string): Promise<HTMLLinkElement> => {
    return new Promise((resolve, reject) => {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.type = "text/css";
        link.href = href;

        link.onload = () => resolve(link);
        link.onerror = () => reject(new Error(`Failed to load CSS: ${href}`));

        document.head.appendChild(link);
    });
};

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

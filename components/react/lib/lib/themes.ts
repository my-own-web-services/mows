export interface MowsTheme {
    readonly id: string;
    readonly name: string;
    readonly url?: string;
}

export const loadThemeCSS = (href: string): Promise<HTMLLinkElement> => {
    return new Promise((resolve, reject) => {
        const link = document.createElement(`link`);
        link.rel = `stylesheet`;
        link.type = `text/css`;
        link.href = href;

        link.onload = () => resolve(link);
        link.onerror = () => reject(new Error(`Failed to load CSS: ${href}`));

        document.head.appendChild(link);
    });
};

export const defaultThemes: MowsTheme[] = [
    {
        id: `system`,
        name: `System`
    },
    {
        id: `light`,
        name: `Light`
    },
    {
        id: `dark`,
        name: `Dark`
    }
];

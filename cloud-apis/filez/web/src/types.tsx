export interface UiConfig {
    interosseaServerAddress: string;
    interosseaWebAddress: string;
    filezServerAddress: string;
    skipInterossea: boolean;
}

export enum FileView {
    Strip = "Strip",
    Grid = "Grid",
    List = "List",
    Group = "Group",
    Single = "Single",
    Sheets = "Sheets"
}

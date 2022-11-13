export interface FilezFile {
    fileId: string;
    mimeType: string;
    name: string;
    ownerId: string;
    sha256: string;
    storageName: string;
    size: number;
    serverCreated: number;
    created: number;
    modified?: number;
    accessed?: number;
    accessedCount: number;
    fileManualGroupIds: string[];
    timeOfDeath?: number;
    appData: { [key: string]: string };
    permissionIds: string[];
    keywords: string[];
}

export interface FileGroup {
    groupId: string;
}

export enum FileView {
    Strip = "Strip",
    Grid = "Grid",
    List = "List",
    Group = "Group",
    Single = "Single",
    Sheets = "Sheets"
}

export interface FilezFile {
    _id: string;
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
    readonly: boolean;
}

export interface ReducedFilezFile {
    _id: string;
    mimeType: string;
    name: string;
    size: number;
}

export interface FileGroup {
    _id: string;
    name?: string;
    ownerId: string;
    permissionIds: string[];
    keywords: string[];
    mimeTypes: string[];
    groupHierarchyPaths: string[][];
    groupType: FileGroupType;
    itemCount: number;
}

export enum FileGroupType {
    Static = "Static",
    Dynamic = "Dynamic"
}

export enum FileView {
    Strip = "Strip",
    Grid = "Grid",
    List = "List",
    Group = "Group",
    Single = "Single",
    Sheets = "Sheets"
}

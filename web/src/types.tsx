export interface FilezFile {
    _id: string;
    mimeType: string;
    name: string;
    ownerId: string;
    pendingNewOwnerId: string | null;
    sha256: string;
    storageId: string | null;
    path: string | null;
    size: number;
    serverCreated: number;
    created: number;
    modified: number | null;
    accessed: number | null;
    accessedCount: number;
    staticFileGroupIds: string[];
    dynamicFileGroupIds: string[];
    timeOfDeath: number | null;
    appData: { [key: string]: any };
    permissionIds: string[];
    keywords: string[];
    readonly: boolean;
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

export interface FilezUser {
    _id: string;
    appData: { [key: string]: any };
    limits: { [key: string]: UsageLimits };
    userGroupIds: string[];
}

export interface UsageLimits {
    maxStorage: number;
    usedStorage: number;
    maxFiles: number;
    usedFiles: number;
    maxBandwidth: number;
    usedBandwidth: number;
}

export interface ProcessedImage {
    mimeType: string;
    width: number;
    height: number;
    resolutions: number[];
}

export interface UiConfig {
    interosseaServerAddress: string;
    filezServerAddress: string;
    skipInterossea: boolean;
}

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
    Static = "static",
    Dynamic = "dynamic"
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
    width: number;
    height: number;
    resolutions: number[];
}

export interface DynamicGroupRule {
    field: string;
    ruleType: DynamicGroupRuleType;
    value: string;
}

export enum DynamicGroupRuleType {
    MatchRegex = "matchRegex",
    NotMatchRegex = "notMatchRegex"
}

export type UpdateFileInfosRequestField =
    | UFIRMimeType
    | UFIRName
    | UFIROwnerId
    | UFIRStorageId
    | UFIRStaticFileGroupIds
    | UFIRKeywords;

export interface UFIRMimeType {
    MimeType: string;
}
export interface UFIRName {
    Name: string;
}
export interface UFIROwnerId {
    OwnerId: string;
}
export interface UFIRStorageId {
    StorageId: string;
}
export interface UFIRStaticFileGroupIds {
    StaticFileGroupIds: string[];
}
export interface UFIRKeywords {
    Keywords: string[];
}

export interface CreateGroupRequest {
    name: string;
    groupType: CreateGroupRequestGroupType;
}

export enum CreateGroupRequestGroupType {
    User = "user",
    File = "file"
}

export interface CreateGroupResponse {
    groupId: string;
}

export interface UpdateFileGroupRequestBody {
    fileGroupId: string;
    newName?: string;
    newDynamicGroupRules?: DynamicGroupRule;
    newGroupType?: FileGroupType;
    newKeywords?: string[];
    newMimeTypes?: string[];
}

export interface CreateFileRequest {
    name: string;
    mimeType: string;
    staticFileGroupIds?: string[];
    storageId?: string;
    created?: number;
    modified?: number;
}

export interface SearchRequest {
    searchType: SearchRequestType;
    limit: number;
}

export interface SearchRequestType {
    simpleSearch?: SimpleSearch;
    advancedSearch?: AdvancedSearch;
}

export interface SimpleSearch {
    query: string;
    groupId: string;
}

export interface AdvancedSearch {
    query: string;
    groupId: string;
    filters: FilterRule[];
}

export interface FilterRule {
    field: string;
    ruleType: FilterRuleType;
    value: string;
}

export enum FilterRuleType {
    MatchRegex = "matchRegex",
    NotMatchRegex = "notMatchRegex"
}

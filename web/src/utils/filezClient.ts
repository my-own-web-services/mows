import { DynamicGroupRuleType, DynamicGroupRule, FileGroup, FilezFile, FilezUser } from "../types";
import { InterosseaClient } from "./interosseaClient";

export class FilezClient {
    interosseaClient: InterosseaClient;
    filezEndpoint: string;

    constructor(
        filezEndpoint: string,
        interosseaServerEndpoint: string,
        interosseaWebEndpoint: string,
        skipInterossea: boolean = false
    ) {
        this.filezEndpoint = filezEndpoint;

        this.interosseaClient = new InterosseaClient(
            interosseaServerEndpoint,
            interosseaWebEndpoint,
            this.filezEndpoint,
            "filez",
            skipInterossea
        );
    }

    init = async () => {
        await this.interosseaClient.init();
    };

    search = async (searchRequest: SearchRequest) => {
        const res = await fetch(`${this.filezEndpoint}/api/search/`, {
            credentials: "include",
            method: "POST",
            body: JSON.stringify(searchRequest)
        });
        const files: FilezFile[] = await res.json();
        return files;
    };

    create_user = async () => {
        const res = await fetch(`${this.filezEndpoint}/api/create_user/`, {
            method: "POST",
            credentials: "include"
        });
    };

    create_file = async (body: any, metadata: CreateFileRequest) => {
        const res = await fetch(`${this.filezEndpoint}/api/create_file/`, {
            method: "POST",
            credentials: "include",
            body,
            headers: {
                request: JSON.stringify(metadata)
            }
        });
    };

    create_group = async (group: CreateGroupRequest) => {
        const res = await fetch(`${this.filezEndpoint}/api/create_group/`, {
            method: "POST",
            credentials: "include",
            body: JSON.stringify(group)
        });
        return (await res.json()) as CreateGroupResponse;
    };

    create_upload_space = async () => {
        const res = await fetch(`${this.filezEndpoint}/api/create_upload_space/`, {
            method: "POST",
            credentials: "include"
        });
    };

    delete_file = async () => {
        const res = await fetch(`${this.filezEndpoint}/api/delete_file/`, {
            method: "POST",
            credentials: "include"
        });
    };

    delete_group = async () => {
        const res = await fetch(`${this.filezEndpoint}/api/delete_group/`, {
            method: "POST",
            credentials: "include"
        });
    };

    delete_permission = async () => {
        const res = await fetch(`${this.filezEndpoint}/api/delete_permission/`, {
            method: "POST",
            credentials: "include"
        });
    };

    delete_upload_space = async () => {
        const res = await fetch(`${this.filezEndpoint}/api/delete_upload_space/`, {
            method: "POST",
            credentials: "include"
        });
    };

    get_file_info = async () => {
        const res = await fetch(`${this.filezEndpoint}/api/get_file_info/`, {
            credentials: "include"
        });
    };

    get_file_infos_by_group_id = async (groupId: string, from_index = 0, limit = 100) => {
        const res = await fetch(
            `${this.filezEndpoint}/api/get_file_infos_by_group_id/${groupId}?i=${from_index}&l=${limit}`,
            {
                credentials: "include"
            }
        );
        const files: FilezFile[] = await res.json();
        return files;
    };

    get_file = async (fileId: string) => {
        const res = await fetch(`${this.filezEndpoint}/api/get_file/${fileId}`, {
            credentials: "include"
        });
        const content = await res.text();
        return content;
    };

    get_own_file_groups = async () => {
        const res = await fetch(`${this.filezEndpoint}/api/get_own_file_groups/`, {
            credentials: "include"
        });
        const fileGroups: FileGroup[] = await res.json();
        return fileGroups;
    };

    get_permissions_for_current_user = async () => {
        const res = await fetch(`${this.filezEndpoint}/api/get_permissions_for_current_user/`, {
            credentials: "include"
        });
    };

    get_user_info = async () => {
        const res = await fetch(`${this.filezEndpoint}/api/get_user_info/`, {
            credentials: "include"
        });
        return (await res.json()) as FilezUser;
    };

    update_file_infos = async (fileId: string, field: UpdateFileInfosRequestField) => {
        const res = await fetch(`${this.filezEndpoint}/api/update_file_infos/`, {
            method: "POST",
            credentials: "include",
            body: JSON.stringify({ fileId, field })
        });
        if (!res.ok) {
            throw new Error("Error updating file infos: " + res.statusText);
        }
    };

    update_file = async () => {
        const res = await fetch(`${this.filezEndpoint}/api/update_file/`, {
            method: "POST",
            credentials: "include"
        });
    };

    update_file_group = async (req: UpdateFileGroupRequestBody) => {
        const res = await fetch(`${this.filezEndpoint}/api/update_file_group/`, {
            method: "POST",
            credentials: "include",
            body: JSON.stringify(req)
        });
    };

    update_permission_ids_on_resource = async () => {
        const res = await fetch(`${this.filezEndpoint}/api/update_permission_ids_on_resource/`, {
            method: "POST",
            credentials: "include"
        });
    };
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

export enum FileGroupType {
    Static = "static",
    Dynamic = "dynamic"
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

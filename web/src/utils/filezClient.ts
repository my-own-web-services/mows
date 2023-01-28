import { FileGroup, FilezFile, FilezUser } from "../types";
import { InterosseaClient } from "./interosseaClient";

export class FilezClient {
    interosseaClient: InterosseaClient;
    constructor(interosseaEndpoint: string, skipInterossea: boolean = false) {
        this.interosseaClient = new InterosseaClient(interosseaEndpoint, skipInterossea);
    }

    init = async () => {
        await this.interosseaClient.init();
    };

    create_file = async () => {
        const res = await fetch(`/api/create_file/`, { method: "POST" });
    };
    create_group = async () => {
        const res = await fetch(`/api/create_group/`, { method: "POST" });
    };
    create_upload_space = async () => {
        const res = await fetch(`/api/create_upload_space/`, { method: "POST" });
    };
    delete_file = async () => {
        const res = await fetch(`/api/delete_file/`, { method: "POST" });
    };
    delete_group = async () => {
        const res = await fetch(`/api/delete_group/`, { method: "POST" });
    };
    delete_permission = async () => {
        const res = await fetch(`/api/delete_permission/`, { method: "POST" });
    };
    delete_upload_space = async () => {
        const res = await fetch(`/api/delete_upload_space/`, { method: "POST" });
    };

    get_file_info = async () => {
        const res = await fetch(`/api/get_file_info/`);
    };

    get_file_infos_by_group_id = async (groupId: string, from_index = 0, limit = 100) => {
        const res = await fetch(
            `/api/get_file_infos_by_group_id/${groupId}?i=${from_index}&l=${limit}`
        );
        const files: FilezFile[] = await res.json();
        return files;
    };
    get_file = async () => {
        const res = await fetch("/api/get_file/");
        const content = await res.text();
        return content;
    };

    get_own_file_groups = async () => {
        const res = await fetch("/api/get_own_file_groups/");
        const fileGroups: FileGroup[] = await res.json();
        return fileGroups;
    };

    get_permissions_for_current_user = async () => {
        const res = await fetch(`/api/get_permissions_for_current_user/`);
    };
    get_user_info = async () => {
        const res = await fetch(`/api/get_user_info/`);
        return (await res.json()) as FilezUser;
    };
    update_file_infos = async (fileId: string, field: UpdateFileInfosRequestField) => {
        const res = await fetch(`/api/update_file_infos/`, {
            method: "POST",
            body: JSON.stringify({ fileId, field })
        });
        if (!res.ok) {
            throw new Error("Error updating file infos: " + res.statusText);
        }
    };
    update_file = async () => {
        const res = await fetch(`/api/update_file/`, { method: "POST" });
    };
    update_permission_ids_on_resource = async () => {
        const res = await fetch(`/api/update_permission_ids_on_resource/`, {
            method: "POST"
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

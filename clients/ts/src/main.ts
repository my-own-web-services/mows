import { InterosseaClient } from "@firstdorsal/interossea-client";
import { FilezFile } from "./apiTypes/FilezFile.js";
import { CreateFileRequest } from "./apiTypes/CreateFileRequest.js";
import { CreateGroupRequest } from "./apiTypes/CreateGroupRequest.js";
import { CreateGroupResponse } from "./apiTypes/CreateGroupResponse.js";
import { SortOrder } from "./apiTypes/SortOrder.js";
import { FilezFileGroup } from "./apiTypes/FilezFileGroup.js";
import { FilezUser } from "./apiTypes/FilezUser.js";
import { UpdateFileInfosRequestField } from "./apiTypes/UpdateFileInfosRequestField.js";
import { UpdateFileGroupRequestBody } from "./apiTypes/UpdateFileGroupRequestBody.js";
import { GetFileInfosByGroupIdResponseBody } from "./apiTypes/GetFileInfosByGroupIdResponseBody.js";
import { FilezPermission } from "./apiTypes/FilezPermission.js";
import { CreatePermissionRequestBody } from "./apiTypes/CreatePermissionRequestBody.js";
import { SearchRequestBody } from "./apiTypes/SearchRequestBody.js";
import { CreatePermissionResponseBody } from "./apiTypes/CreatePermissionResponseBody.js";
import { GetUserListResponseBody } from "./apiTypes/GetUserListResponseBody.js";
import { UpdateFriendshipStatusRequestBody } from "./apiTypes/UpdateFriendshipStatusRequestBody.js";
import { UpdateFriendStatus } from "./apiTypes/UpdateFriendStatus.js";

export * from "./types.js";

export class FilezClient {
    interosseaClient: InterosseaClient;
    filezEndpoint: string;

    constructor(
        filezEndpoint: string,
        interosseaServerEndpoint: string,
        interosseaWebEndpoint: string,
        applicationName: string,
        skipInterossea: boolean = false
    ) {
        this.filezEndpoint = filezEndpoint;

        this.interosseaClient = new InterosseaClient(
            interosseaServerEndpoint,
            interosseaWebEndpoint,
            this.filezEndpoint,
            applicationName,
            skipInterossea
        );
    }

    init = async () => {
        await this.interosseaClient.init();
    };

    create_permission = async (body: CreatePermissionRequestBody) => {
        const res = await fetch(`${this.filezEndpoint}/api/permission/create/`, {
            method: "POST",
            credentials: "include",
            body: JSON.stringify(body)
        });
        const json: CreatePermissionResponseBody = await res.json();
        return json;
    };

    create_own_user = async () => {
        const res = await fetch(`${this.filezEndpoint}/api/user/create_own/`, {
            method: "POST",
            credentials: "include"
        });
    };

    create_file = async (body: any, metadata: CreateFileRequest) => {
        const res = await fetch(`${this.filezEndpoint}/api/file/create/`, {
            method: "POST",
            credentials: "include",
            body,
            headers: {
                request: JSON.stringify(metadata)
            }
        });
    };

    create_group = async (group: CreateGroupRequest) => {
        const res = await fetch(`${this.filezEndpoint}/api/group/create/`, {
            method: "POST",
            credentials: "include",
            body: JSON.stringify(group)
        });
        return (await res.json()) as CreateGroupResponse;
    };

    create_upload_space = async () => {
        const res = await fetch(`${this.filezEndpoint}/api/upload_space/create/`, {
            method: "POST",
            credentials: "include"
        });
    };
    delete_upload_space = async () => {
        const res = await fetch(`${this.filezEndpoint}/api/upload_space/delete/`, {
            method: "POST",
            credentials: "include"
        });
    };

    delete_file = async () => {
        const res = await fetch(`${this.filezEndpoint}/api/file/delete/`, {
            method: "POST",
            credentials: "include"
        });
    };

    delete_group = async () => {
        const res = await fetch(`${this.filezEndpoint}/api/group/delete/`, {
            method: "POST",
            credentials: "include"
        });
    };

    delete_permission = async () => {
        const res = await fetch(`${this.filezEndpoint}/api/permission/delete/`, {
            method: "POST",
            credentials: "include"
        });
    };

    get_file_info = async (fileId: string) => {
        const res = await fetch(`${this.filezEndpoint}/api/file/info/get/${fileId}`, {
            credentials: "include"
        });
        const file: FilezFile = await res.json();
        return file;
    };

    get_file_infos_by_group_id = async (
        groupId: string,
        from_index: number,
        limit: number | null,
        sort_field: string | null,
        sort_order: SortOrder | null,
        filter: string | null
    ) => {
        const url = `${
            this.filezEndpoint
        }/api/get_file_infos_by_group_id/${groupId}?i=${from_index}${
            limit === null ? "" : "&l=" + limit
        }${sort_field === null ? "" : "&f=" + sort_field}${
            sort_order === null ? "" : "&o=" + sort_order
        }${filter === null ? "" : "&s=" + filter}`;

        const res = await fetch(url, {
            credentials: "include"
        });
        const files: GetFileInfosByGroupIdResponseBody = await res.json();
        return files;
    };

    get_file = async (file_id: string) => {
        const res = await fetch(`${this.filezEndpoint}/api/file/get/${file_id}`, {
            credentials: "include"
        });
        const content = await res.text();
        return content;
    };

    get_own_file_groups = async () => {
        const res = await fetch(`${this.filezEndpoint}/api/get_own_file_groups/`, {
            credentials: "include"
        });
        const fileGroups: FilezFileGroup[] = await res.json();
        return fileGroups;
    };

    get_permissions_for_current_user = async () => {
        const res = await fetch(`${this.filezEndpoint}/api/get_permissions_for_current_user/`, {
            credentials: "include"
        });

        const json: FilezPermission[] = await res.json();
        return json;
    };

    get_user = async () => {
        const res = await fetch(`${this.filezEndpoint}/api/user/get/`, {
            credentials: "include"
        });
        return (await res.json()) as FilezUser;
    };

    get_user_list = async (
        from_index: number,
        limit: number | null,
        sort_field: string | null,
        sort_order: SortOrder | null,
        filter: string | null
    ) => {
        const url = `${this.filezEndpoint}/api/get_user_list/?i=${from_index}${
            limit === null ? "" : "&l=" + limit
        }${sort_field === null ? "" : "&f=" + sort_field}${
            sort_order === null ? "" : "&o=" + sort_order
        }${filter === null ? "" : "&s=" + filter}`;

        const res = await fetch(url, {
            credentials: "include"
        });
        return (await res.json()) as GetUserListResponseBody;
    };

    update_friendship_status = async (user_id: string, new_status: UpdateFriendStatus) => {
        const body: UpdateFriendshipStatusRequestBody = { user_id, new_status };

        const res = await fetch(`${this.filezEndpoint}/api/user/update_friendship_status/`, {
            method: "POST",
            credentials: "include",
            body: JSON.stringify(body)
        });

        return res;
    };

    get_aggregated_keywords = async () => {
        const res = await fetch(`${this.filezEndpoint}/api/get_aggregated_keywords/`, {
            credentials: "include"
        });
        const json: string[] = await res.json();
        return json;
    };

    update_file_infos = async (fileId: string, field: UpdateFileInfosRequestField) => {
        const res = await fetch(`${this.filezEndpoint}/api/file/info/update/`, {
            method: "POST",
            credentials: "include",
            body: JSON.stringify({ fileId, field })
        });
        return res;
    };

    update_file = async () => {
        const res = await fetch(`${this.filezEndpoint}/api/file/update/`, {
            method: "POST",
            credentials: "include"
        });
    };

    update_file_group = async (req: UpdateFileGroupRequestBody) => {
        const res = await fetch(`${this.filezEndpoint}/api/file_group/update/`, {
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

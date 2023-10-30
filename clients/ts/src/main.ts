import { InterosseaClient } from "@firstdorsal/interossea-client";
import { FilezFile } from "./apiTypes/FilezFile.js";
import { CreateFileRequest } from "./apiTypes/CreateFileRequest.js";
import { FilezFileGroup } from "./apiTypes/FilezFileGroup.js";
import { FilezUser } from "./apiTypes/FilezUser.js";
import { UpdateFileInfosRequestField } from "./apiTypes/UpdateFileInfosRequestField.js";
import { UpdateFileGroupRequestBody } from "./apiTypes/UpdateFileGroupRequestBody.js";
import { FilezPermission } from "./apiTypes/FilezPermission.js";
import { UpdateFriendshipStatusRequestBody } from "./apiTypes/UpdateFriendshipStatusRequestBody.js";
import { UpdateFriendStatus } from "./apiTypes/UpdateFriendStatus.js";
import { CreateFileGroupRequestBody } from "./apiTypes/CreateFileGroupRequestBody.js";
import { CreateUserGroupRequestBody } from "./apiTypes/CreateUserGroupRequestBody.js";
import { GetResourceParams } from "./types.js";
import { GetItemListResponseBody } from "./apiTypes/GetItemListResponseBody.js";
import { UserGroup } from "./apiTypes/UserGroup.js";
import { ReducedFilezUser } from "./apiTypes/ReducedFilezUser.js";
import { UpdatePermissionRequestBody } from "./apiTypes/UpdatePermissionRequestBody.js";
import { UpdatePermissionResponseBody } from "./apiTypes/UpdatePermissionResponseBody.js";

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

    update_permission = async (body: UpdatePermissionRequestBody) => {
        const res = await fetch(`${this.filezEndpoint}/api/permission/update/`, {
            method: "POST",
            credentials: "include",
            body: JSON.stringify(body),
            headers: {
                "Content-Type": "application/json"
            }
        });
        const json: UpdatePermissionResponseBody = await res.json();
        return json;
    };

    create_own_user = async () => {
        const res = await fetch(`${this.filezEndpoint}/api/user/create_own/`, {
            method: "POST",
            credentials: "include"
        });
        return res;
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
        return res;
    };

    create_upload_space = async () => {
        const res = await fetch(`${this.filezEndpoint}/api/upload_space/create/`, {
            method: "POST",
            credentials: "include"
        });
        return res;
    };
    delete_upload_space = async () => {
        const res = await fetch(`${this.filezEndpoint}/api/upload_space/delete/`, {
            method: "POST",
            credentials: "include"
        });
        return res;
    };

    delete_file = async (file_id: string) => {
        const res = await fetch(`${this.filezEndpoint}/api/file/delete/${file_id}`, {
            method: "POST",
            credentials: "include"
        });
        return res;
    };

    delete_permission = async (permission_id: string) => {
        const res = await fetch(`${this.filezEndpoint}/api/permission/delete/${permission_id}`, {
            method: "POST",
            credentials: "include"
        });
        return res;
    };

    get_file_info = async (fileId: string) => {
        const res = await fetch(`${this.filezEndpoint}/api/file/info/get/${fileId}`, {
            credentials: "include"
        });
        const file: FilezFile = await res.json();
        return file;
    };

    get_file_infos_by_group_id = async (params: GetResourceParams) => {
        const url = `${this.filezEndpoint}/api/get_file_infos_by_group_id/${
            params.id ? params.id : ""
        }?i=${params.from_index}${params.limit === null ? "" : "&l=" + params.limit}${
            params.sort_field === null ? "" : "&f=" + params.sort_field
        }${params.sort_order === null ? "" : "&o=" + params.sort_order}${
            params.filter === null ? "" : "&s=" + params.filter
        }`;

        const res = await fetch(url, {
            credentials: "include"
        });

        const json: GetItemListResponseBody<FilezFile> = await res.json();

        return json;
    };

    get_file = async (file_id: string) => {
        const res = await fetch(`${this.filezEndpoint}/api/file/get/${file_id}`, {
            credentials: "include"
        });
        const content = await res.text();
        return content;
    };

    get_own_file_groups = async (params: GetResourceParams) => {
        const url = `${this.filezEndpoint}/api/get_own_file_groups/${
            params.id ? params.id : ""
        }?i=${params.from_index}${params.limit === null ? "" : "&l=" + params.limit}${
            params.sort_field === null ? "" : "&f=" + params.sort_field
        }${params.sort_order === null ? "" : "&o=" + params.sort_order}${
            params.filter === null ? "" : "&s=" + params.filter
        }`;

        const res = await fetch(url, {
            credentials: "include"
        });
        const json: GetItemListResponseBody<FilezFileGroup> = await res.json();

        return json;
    };

    get_own_permissions = async (params: GetResourceParams) => {
        const url = `${this.filezEndpoint}/api/get_own_permissions/${
            params.id ? params.id : ""
        }?i=${params.from_index}${params.limit === null ? "" : "&l=" + params.limit}${
            params.sort_field === null ? "" : "&f=" + params.sort_field
        }${params.sort_order === null ? "" : "&o=" + params.sort_order}${
            params.filter === null ? "" : "&s=" + params.filter
        }`;
        const res = await fetch(url, {
            credentials: "include"
        });

        const json: GetItemListResponseBody<FilezPermission> = await res.json();

        return json;
    };

    get_user = async () => {
        const res = await fetch(`${this.filezEndpoint}/api/user/get/`, {
            credentials: "include"
        });
        return (await res.json()) as FilezUser;
    };

    get_user_list = async (params: GetResourceParams) => {
        const url = `${this.filezEndpoint}/api/get_user_list/${params.id ? params.id : ""}?i=${
            params.from_index
        }${params.limit === null ? "" : "&l=" + params.limit}${
            params.sort_field === null ? "" : "&f=" + params.sort_field
        }${params.sort_order === null ? "" : "&o=" + params.sort_order}${
            params.filter === null ? "" : "&s=" + params.filter
        }`;

        const res = await fetch(url, {
            credentials: "include"
        });

        const json: GetItemListResponseBody<ReducedFilezUser> = await res.json();

        return json;
    };

    update_friendship_status = async (user_id: string, new_status: UpdateFriendStatus) => {
        const body: UpdateFriendshipStatusRequestBody = { user_id, new_status };

        const res = await fetch(`${this.filezEndpoint}/api/user/update_friendship_status/`, {
            method: "POST",
            credentials: "include",
            body: JSON.stringify(body),
            headers: {
                "Content-Type": "application/json"
            }
        });

        return res;
    };

    get_user_group_list = async (params: GetResourceParams) => {
        const url = `${this.filezEndpoint}/api/get_user_group_list/${
            params.id ? params.id : ""
        }?i=${params.from_index}${params.limit === null ? "" : "&l=" + params.limit}${
            params.sort_field === null ? "" : "&f=" + params.sort_field
        }${params.sort_order === null ? "" : "&o=" + params.sort_order}${
            params.filter === null ? "" : "&s=" + params.filter
        }`;

        const res = await fetch(url, {
            credentials: "include"
        });

        const json: GetItemListResponseBody<UserGroup> = await res.json();

        return json;
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
            body: JSON.stringify({ fileId, field }),
            headers: {
                "Content-Type": "application/json"
            }
        });
        return res;
    };

    update_file = async () => {
        const res = await fetch(`${this.filezEndpoint}/api/file/update/`, {
            method: "POST",
            credentials: "include"
        });
        return res;
    };

    update_file_group = async (req: UpdateFileGroupRequestBody) => {
        const res = await fetch(`${this.filezEndpoint}/api/file_group/update/`, {
            method: "POST",
            credentials: "include",
            body: JSON.stringify(req),
            headers: {
                "Content-Type": "application/json"
            }
        });
        return res;
    };

    update_permission_ids_on_resource = async () => {
        const res = await fetch(`${this.filezEndpoint}/api/update_permission_ids_on_resource/`, {
            method: "POST",
            credentials: "include"
        });
        return res;
    };

    create_file_group = async (body: CreateFileGroupRequestBody) => {
        const res = await fetch(`${this.filezEndpoint}/api/file_group/create/`, {
            method: "POST",
            credentials: "include",
            body: JSON.stringify(body),
            headers: {
                "Content-Type": "application/json"
            }
        });
        return res;
    };

    create_user_group = async (body: CreateUserGroupRequestBody) => {
        const res = await fetch(`${this.filezEndpoint}/api/user_group/create/`, {
            method: "POST",
            credentials: "include",
            body: JSON.stringify(body),
            headers: {
                "Content-Type": "application/json"
            }
        });
        return res;
    };

    delete_file_group = async (group_id: string) => {
        const res = await fetch(`${this.filezEndpoint}/api/file_group/delete/${group_id}`, {
            method: "POST",
            credentials: "include"
        });
        return res;
    };

    delete_user_group = async (group_id: string) => {
        const res = await fetch(`${this.filezEndpoint}/api/user_group/delete/${group_id}`, {
            method: "POST",
            credentials: "include"
        });
        return res;
    };
}

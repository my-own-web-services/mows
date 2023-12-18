import { InterosseaClient } from "@firstdorsal/interossea-client";
import { FilezFile } from "./apiTypes/FilezFile.js";
import { CreateFileRequest } from "./apiTypes/CreateFileRequest.js";
import { FilezFileGroup } from "./apiTypes/FilezFileGroup.js";
import { FilezUser } from "./apiTypes/FilezUser.js";
import { UpdateFileGroupRequestBody } from "./apiTypes/UpdateFileGroupRequestBody.js";
import { FilezPermission } from "./apiTypes/FilezPermission.js";
import { UpdateFriendshipStatusRequestBody } from "./apiTypes/UpdateFriendshipStatusRequestBody.js";
import { UpdateFriendStatus } from "./apiTypes/UpdateFriendStatus.js";
import { CreateFileGroupRequestBody } from "./apiTypes/CreateFileGroupRequestBody.js";
import { CreateUserGroupRequestBody } from "./apiTypes/CreateUserGroupRequestBody.js";
import { GetFileOptions } from "./types.js";
import { GetItemListResponseBody } from "./apiTypes/GetItemListResponseBody.js";
import { ReducedFilezUser } from "./apiTypes/ReducedFilezUser.js";
import { UpdatePermissionRequestBody } from "./apiTypes/UpdatePermissionRequestBody.js";
import { UpdatePermissionResponseBody } from "./apiTypes/UpdatePermissionResponseBody.js";
import { UpdateUserGroupRequestBody } from "./apiTypes/UpdateUserGroupRequestBody.js";
import { FilezUserGroup } from "./apiTypes/FilezUserGroup.js";
import { FileGroupType } from "./apiTypes/FileGroupType.js";
import { GetFileInfosResponseBody } from "./apiTypes/GetFileInfosResponseBody.js";
import { GetFileGroupsRequestBody } from "./apiTypes/GetFileGroupsRequestBody.js";
import { GetFileInfosRequestBody } from "./apiTypes/GetFileInfosRequestBody.js";
import { GetFileGroupsResponseBody } from "./apiTypes/GetFileGroupsResponseBody.js";
import { UpdateFileInfosRequestBody } from "./apiTypes/UpdateFileInfosRequestBody.js";
import { CreateFileGroupResponseBody } from "./apiTypes/CreateFileGroupResponseBody.js";
import { GetItemListRequestBody } from "./apiTypes/GetItemListRequestBody.js";
import { PermissionResourceSelectType } from "./apiTypes/PermissionResourceSelectType.js";
import { DeleteFileRequestBody } from "./apiTypes/DeleteFileRequestBody.js";
import { DeleteFileGroupRequestBody } from "./apiTypes/DeleteFileGroupRequestBody.js";
import { DeleteUserGroupRequestBody } from "./apiTypes/DeleteUserGroupRequestBody.js";
import { DeletePermissionRequestBody } from "./apiTypes/DeletePermissionRequestBody.js";
import { CreatePermissionRequestBody } from "./apiTypes/CreatePermissionRequestBody.js";
import { CreatePermissionResponseBody } from "./apiTypes/CreatePermissionResponseBody.js";

export * from "./types.js";

export class FilezClient {
    interosseaClient: InterosseaClient;
    filezEndpoint: string;
    initialized: boolean = false;

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
        this.initialized = true;
    };

    update_permission = async (body: UpdatePermissionRequestBody) => {
        if (!this.initialized) await this.init();
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

    create_permission = async (body: CreatePermissionRequestBody) => {
        if (!this.initialized) await this.init();
        const res = await fetch(`${this.filezEndpoint}/api/permission/create/`, {
            method: "POST",
            credentials: "include",
            body: JSON.stringify(body),
            headers: {
                "Content-Type": "application/json"
            }
        });
        const json: CreatePermissionResponseBody = await res.json();
        return json;
    }

    create_own_user = async () => {
        if (!this.initialized) await this.init();
        const res = await fetch(`${this.filezEndpoint}/api/user/create_own/`, {
            method: "POST",
            credentials: "include"
        });
        return res;
    };

    create_file = async (body: any, metadata: CreateFileRequest) => {
        if (!this.initialized) await this.init();
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

    create_file_with_upload_progress = async (
        body: any,
        metadata: CreateFileRequest,
        onProgress: (uploadedBytes: number) => void,
        onError: (error: any) => void
    ) => {
        if (!this.initialized) await this.init();
        const xhr = new XMLHttpRequest();
        const success = new Promise((resolve, reject) => {
            xhr.upload.addEventListener("progress", event => {
                if (event.lengthComputable) {
                    onProgress(event.loaded);
                }
            });
            xhr.withCredentials = true;

            xhr.open("POST", `${this.filezEndpoint}/api/file/create/`, true);
            xhr.setRequestHeader("request", JSON.stringify(metadata));
            xhr.send(body);

            xhr.addEventListener("error", () => {
                onError(xhr.response);
            });

            xhr.addEventListener("loadend", () => {
                resolve(xhr.readyState === 4 && xhr.status === 200);
            });
        });
        return { success, xhr };
    };


    delete_files = async (file_ids: string[]) => {
        if (!this.initialized) await this.init();
        const body: DeleteFileRequestBody = { file_ids };
        const res = await fetch(`${this.filezEndpoint}/api/file/delete/`, {
            method: "POST",
            credentials: "include",
            body: JSON.stringify(body),
        });
        return res;
    };

    delete_permissions = async (permission_ids: string[]) => {
        if (!this.initialized) await this.init();
        const body: DeletePermissionRequestBody = { permission_ids };
        const res = await fetch(
            `${this.filezEndpoint}/api/permission/delete/`,
            {
                method: "POST",
                credentials: "include",
                body: JSON.stringify(body)
            }
        );
        return res;
    };

    get_file_infos = async (file_ids: string[]) => {
        if (!this.initialized) await this.init();

        const body: GetFileInfosRequestBody = { file_ids };
        const res = await fetch(`${this.filezEndpoint}/api/file/info/get/`, {
            credentials: "include",
            method: "POST",
            body: JSON.stringify(body),
            headers: {
                "Content-Type": "application/json"
            }
        });
        const json: GetFileInfosResponseBody = await res.json();

        return json.files;
    };

    get_file_groups = async (file_group_ids: string[]) => {
        if (!this.initialized) await this.init();
        const body: GetFileGroupsRequestBody = { file_group_ids };
        const res = await fetch(`${this.filezEndpoint}/api/file_group/get/`, {
            credentials: "include",
            method: "POST",
            body: JSON.stringify(body),
            headers: {
                "Content-Type": "application/json"
            }
        });
        const json: GetFileGroupsResponseBody = await res.json();

        return json.file_groups;
    };

    list_file_infos_by_group_id = async (body?: GetItemListRequestBody) => {
        if (!this.initialized) await this.init();

        const res = await fetch(`${this.filezEndpoint}/api/file/info/list/`, {
            credentials: "include",
            method: "POST",
            body: JSON.stringify(body??{}),
            headers: {
                "Content-Type": "application/json"
            }
        });

        const json: GetItemListResponseBody<FilezFile> = await res.json();

        return json;
    };

    get_file = async (file_id: string, options?: GetFileOptions) => {
        if (!this.initialized) await this.init();
        const res = await fetch(
            `${this.filezEndpoint}/api/file/get/${file_id}${options?.cache ? "?c" : ""}`,
            {
                credentials: "include",
                headers: {
                    ...(options?.range && {
                        Range: `bytes=${options?.range.from}-${options?.range.to}`
                    })
                }
            }
        );

        return res;
    };

    list_file_groups = async (body?: GetItemListRequestBody,group_type?:FileGroupType) => {
        if (!this.initialized) await this.init();

        const res = await fetch(`${this.filezEndpoint}/api/file_group/list/${group_type!==undefined?`?t=${group_type}`:``}`, {
            credentials: "include",
            method: "POST",
            body: JSON.stringify(body??{}),
            headers: {
                "Content-Type": "application/json"
            }
        });
        const json: GetItemListResponseBody<FilezFileGroup> = await res.json();

        return json;
    };

    list_permissions = async (body?: GetItemListRequestBody) => {
        if (!this.initialized) await this.init();

        const res = await fetch(`${this.filezEndpoint}/api/permission/list/`, {
            credentials: "include",
            method: "POST",
            body: JSON.stringify(body??{}),
            headers: {
                "Content-Type": "application/json"
            }
        });

        const json: GetItemListResponseBody<FilezPermission> = await res.json();

        return json;
    };

    get_own_user = async () => {
        if (!this.initialized) await this.init();
        const res = await fetch(`${this.filezEndpoint}/api/user/get_own/`, {
            credentials: "include"
        });
        return (await res.json()) as FilezUser;
    };

    list_users = async (body?: GetItemListRequestBody) => {
        if (!this.initialized) await this.init();

        const res = await fetch(`${this.filezEndpoint}/api/user/list/`, {
            credentials: "include",
            method: "POST",
            body: JSON.stringify(body??{}),
            headers: {
                "Content-Type": "application/json"
            }
        });

        const json: GetItemListResponseBody<ReducedFilezUser> = await res.json();

        return json;
    };

    update_friendship_status = async (user_id: string, new_status: UpdateFriendStatus) => {
        if (!this.initialized) await this.init();
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

    list_user_groups = async (body?: GetItemListRequestBody) => {
        if (!this.initialized) await this.init();

        const res = await fetch(`${this.filezEndpoint}/api/user_group/list/`, {
            credentials: "include",
            method: "POST",
            body: JSON.stringify(body??{}),
            headers: {
                "Content-Type": "application/json"
            }
        });

        const json: GetItemListResponseBody<FilezUserGroup> = await res.json();

        return json;
    };

    get_aggregated_keywords = async () => {
        if (!this.initialized) await this.init();
        const res = await fetch(`${this.filezEndpoint}/api/get_aggregated_keywords/`, {
            credentials: "include"
        });
        const json: string[] = await res.json();
        return json;
    };

    get_storage_list = async () => {
        if (!this.initialized) await this.init();
    };

    update_file_infos = async (body: UpdateFileInfosRequestBody) => {
        if (!this.initialized) await this.init();
        const res = await fetch(`${this.filezEndpoint}/api/file/info/update/`, {
            method: "POST",
            credentials: "include",
            body: JSON.stringify(body),
            headers: {
                "Content-Type": "application/json"
            }
        });
        return res;
    };

    update_file = async () => {
        if (!this.initialized) await this.init();
        const res = await fetch(`${this.filezEndpoint}/api/file/update/`, {
            method: "POST",
            credentials: "include"
        });
        return res;
    };

    update_file_group = async (req: UpdateFileGroupRequestBody) => {
        if (!this.initialized) await this.init();
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

    update_user_group = async (req: UpdateUserGroupRequestBody) => {
        if (!this.initialized) await this.init();
        const res = await fetch(`${this.filezEndpoint}/api/user_group/update/`, {
            method: "POST",
            credentials: "include",
            body: JSON.stringify(req),
            headers: {
                "Content-Type": "application/json"
            }
        });
        return res;
    };

    create_file_group = async (body: CreateFileGroupRequestBody) => {
        if (!this.initialized) await this.init();
        const res = await fetch(`${this.filezEndpoint}/api/file_group/create/`, {
            method: "POST",
            credentials: "include",
            body: JSON.stringify(body),
            headers: {
                "Content-Type": "application/json"
            }
        });

        const json: CreateFileGroupResponseBody = await res.json();

        return json;
    };

    create_user_group = async (body: CreateUserGroupRequestBody) => {
        if (!this.initialized) await this.init();
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

    delete_file_groups = async (group_ids: string[]) => {
        if (!this.initialized) await this.init();
        const body: DeleteFileGroupRequestBody = {group_ids}
        const res = await fetch(`${this.filezEndpoint}/api/file_group/delete/`, {
            method: "POST",
            credentials: "include",
            body: JSON.stringify(body),
        });
        
        return res;
    };

    delete_user_groups = async (group_ids: string[]) => {
        if (!this.initialized) await this.init();
        const body: DeleteUserGroupRequestBody = {group_ids}
        const res = await fetch(`${this.filezEndpoint}/api/user_group/delete/`, {
            method: "POST",
            credentials: "include",
            body: JSON.stringify(body),
        });
        return res;
    };
}

import { FileGroup, ReducedFilezFile } from "../types";
import { InterosseaClient } from "./interosseaClient";

export class FilezClient {
    interosseaClient: InterosseaClient;
    constructor(interosseaEndpoint: string) {
        this.interosseaClient = new InterosseaClient(interosseaEndpoint, true);
    }

    init = async () => {
        await this.interosseaClient.init();
    };

    create_file = async () => {
        const res = await this.interosseaClient.f(`/api/create_file/`, { method: "POST" });
        const json = await res.json();
    };
    create_group = async () => {
        const res = await this.interosseaClient.f(`/api/create_group/`, { method: "POST" });
        const json = await res.json();
    };
    create_upload_space = async () => {
        const res = await this.interosseaClient.f(`/api/create_upload_space/`, { method: "POST" });
        const json = await res.json();
    };
    delete_file = async () => {
        const res = await this.interosseaClient.f(`/api/delete_file/`, { method: "POST" });
        const json = await res.json();
    };
    delete_group = async () => {
        const res = await this.interosseaClient.f(`/api/delete_group/`, { method: "POST" });
        const json = await res.json();
    };
    delete_permission = async () => {
        const res = await this.interosseaClient.f(`/api/delete_permission/`, { method: "POST" });
        const json = await res.json();
    };
    delete_upload_space = async () => {
        const res = await this.interosseaClient.f(`/api/delete_upload_space/`, { method: "POST" });
        const json = await res.json();
    };

    get_file_info = async () => {
        const res = await this.interosseaClient.f(`/api/get_file_info/`);
        const json = await res.json();
    };

    get_file_infos_by_group_id = async (groupId: string, from_index = 0, limit = 100) => {
        const res = await this.interosseaClient.f(
            `/api/get_file_infos_by_group_id/${groupId}?i=${from_index}&l=${limit}`
        );
        const files: ReducedFilezFile[] = await res.json();
        return files;
    };
    get_file = async () => {
        const res = await this.interosseaClient.f("/api/get_file/");
        const content = await res.text();
        return content;
    };

    get_own_file_groups = async () => {
        const res = await this.interosseaClient.f("/api/get_own_file_groups/");
        const fileGroups: FileGroup[] = await res.json();
        return fileGroups;
    };

    get_permissions_for_current_user = async () => {
        const res = await this.interosseaClient.f(`/api/get_permissions_for_current_user/`);
        const json = await res.json();
    };
    get_user_info = async () => {
        const res = await this.interosseaClient.f(`/api/get_user_info/`);
        const json = await res.json();
    };
    update_file_info = async () => {
        const res = await this.interosseaClient.f(`/api/update_file_info/`, { method: "POST" });
        const json = await res.json();
    };
    update_file = async () => {
        const res = await this.interosseaClient.f(`/api/update_file/`, { method: "POST" });
        const json = await res.json();
    };
    update_permission_ids_on_resource = async () => {
        const res = await this.interosseaClient.f(`/api/update_permission_ids_on_resource/`, {
            method: "POST"
        });
        const json = await res.json();
    };
}

import { FileGroup, ReducedFilezFile } from "../types";
import { InterosseaClient } from "./interosseaClient";

export class FilezClient {
    interosseaClient: InterosseaClient;
    constructor(interosseaEndpoint: string) {
        this.interosseaClient = new InterosseaClient(interosseaEndpoint);
    }

    init = async () => {
        await this.interosseaClient.init();
    };

    get_file_infos_by_group_id = async (groupId: string, from_index = 0, limit = 100) => {
        const res = await this.interosseaClient.f(
            `/api/get_file_infos_by_group_id/${groupId}?i=${from_index}&l=${limit}`
        );
        const files: ReducedFilezFile[] = await res.json();
        return files;
    };

    get_own_file_groups = async () => {
        const res = await this.interosseaClient.f("/api/get_own_file_groups/");
        const fileGroups: FileGroup[] = await res.json();
        return fileGroups;
    };

    get_file = async () => {
        const res = await this.interosseaClient.f("/api/get_file/");
        const fileGroups = await res.text();
        return fileGroups;
    };
}

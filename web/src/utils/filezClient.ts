import { FileGroup, FilezFile } from "../types";

export class FilezClient {
    constructor() {}

    get_file_infos_by_group_id = async (groupId: string) => {
        const res = await fetch(`/api/get_file_infos_by_group_id/${groupId}`);
        const files: FilezFile[] = await res.json();
        return files;
    };
    get_own_file_groups = async () => {
        const res = await fetch("/api/get_own_file_groups/");
        const fileGroups: FileGroup[] = await res.json();
        return fileGroups;
    };

    get_file = async () => {
        const res = await fetch("/api/get_file/");
        const fileGroups = await res.json();
        return fileGroups;
    };
}

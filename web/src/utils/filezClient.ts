import { FileGroup, ReducedFilezFile } from "../types";

export class FilezClient {
    constructor() {}

    get_file_infos_by_group_id = async (groupId: string, from_index = 0, limit?: number) => {
        const res = await fetch(
            `/api/get_file_infos_by_group_id/${groupId}?i=${from_index}${
                limit ? `&l=${limit}` : ""
            }`
        );
        const files: ReducedFilezFile[] = await res.json();
        return files;
    };

    get_own_file_groups = async () => {
        const res = await fetch("/api/get_own_file_groups/");
        const fileGroups: FileGroup[] = await res.json();
        return fileGroups;
    };

    get_group_size_by_id = async (groupId: string) => {
        const res = await fetch(`/api/get_group_size_by_id/${groupId}`);
        const fileGroups = await res.text();
        return fileGroups;
    };

    get_file = async () => {
        const res = await fetch("/api/get_file/");
        const fileGroups = await res.text();
        return fileGroups;
    };
}

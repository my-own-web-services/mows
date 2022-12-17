import { FileGroup, ReducedFilezFile } from "../types";

export class FilezClient {
    constructor() {}

    get_file_infos_by_group_id = async (groupId: string, from_index = 0, limit = 100) => {
        const res = await fetch(
            `/api/get_file_infos_by_group_id/${groupId}?i=${from_index}&l=${limit}`
        );
        const files: ReducedFilezFile[] = await res.json();
        return files;
    };

    get_own_file_groups = async () => {
        const res = await fetch("/api/get_own_file_groups/");
        const fileGroups: FileGroup[] = await res.json();
        return fileGroups;
    };

    get_file = async () => {
        const res = await fetch("/api/get_file/");
        const fileGroups = await res.text();
        return fileGroups;
    };
}

/*

let res=await fetch(`http://localhost:8081/api/get_user_assertion/?s=filez`,{method:"POST",credentials:"include"});
let token=await res.text();

*/

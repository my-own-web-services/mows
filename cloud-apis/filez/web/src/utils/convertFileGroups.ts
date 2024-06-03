import { FileGroup } from "@firstdorsal/filez-client";

export const convertFileGroups = (fileGroups: FileGroup[]): VisualFileGroup[] => {
    // convert the file groups to a list of file groups and file group folders

    const fileGroupsExpanded: FileGroup[] = [];

    fileGroups.forEach(fileGroup => {
        if (fileGroup.groupHierarchyPaths.length > 0) {
            fileGroup.groupHierarchyPaths.forEach(groupHierarchyPath => {
                fileGroupsExpanded.push({
                    ...fileGroup,
                    groupHierarchyPaths: [groupHierarchyPath]
                });
            });
        } else {
            fileGroupsExpanded.push(fileGroup);
        }
    });

    fileGroups = fileGroupsExpanded.sort((a, b) => {
        const ghp1 = a.groupHierarchyPaths[0]?.join();
        const ghp2 = b.groupHierarchyPaths[0]?.join();
        if (!ghp1) {
            return -1;
        }
        if (!ghp2) {
            return 1;
        }
        return ghp1.localeCompare(ghp2);
    });
    const visualFileGroups: VisualFileGroup[] = [];
    for (const fileGroup of fileGroups) {
        const folders = fileGroup.groupHierarchyPaths[0];

        for (let i = 0; i < folders?.length ?? 0; i++) {
            const folder = folders[i];
            const exists = visualFileGroups.find(f => f.name === folder);
            if (!exists) {
                visualFileGroups.push({
                    name: folder,
                    type: VisualFileGroupType.FileGroupFolder,
                    depth: i,
                    isOpen: false,
                    clientId: folder,
                    itemCount: fileGroup.itemCount
                });
            }
        }
        visualFileGroups.push({
            name: fileGroup.name ?? fileGroup._id,
            type: VisualFileGroupType.FileGroup,
            depth: folders?.length ?? 0,
            fileGroup,
            isOpen: false,
            clientId: fileGroup._id + (folders && folders.length ? folders.join() : ""),
            itemCount: fileGroup.itemCount
        });
    }
    return visualFileGroups;
};

export interface VisualFileGroup {
    type: VisualFileGroupType;
    depth: number;
    name: string;
    clientId: string;
    fileGroup?: FileGroup;
    isOpen: boolean;
    itemCount: number;
}

export enum VisualFileGroupType {
    FileGroup,
    FileGroupFolder
}

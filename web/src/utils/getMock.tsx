import { FileGroup, FileGroupType } from "../types";

export const getMockFiles = () => {
    const files = [];
    for (let i = 0; i < 506; i++) {
        files.push({
            fileId: Math.random().toString(36).substring(7),
            name: Math.random().toString(36).substring(7),
            mimeType: "application/pdf",
            ownerId: "1",
            sha256: "1",
            storageName: "1",
            size: 1,
            serverCreated: 1,
            created: 1,
            modified: 1,
            accessed: 1,
            accessedCount: 1,
            fileManualGroupIds: [],
            timeOfDeath: 1,
            appData: {
                "1": "1"
            },
            permissionIds: [],
            keywords: []
        });
    }
    return files;
};

export const getMockFileGroups = (): FileGroup[] => {
    return [
        {
            _key: Math.random().toString(36).substring(7),
            name: "Augsburg",
            ownerId: "1",
            permissionIds: [],
            keywords: [],
            mimeTypes: [],
            groupHierarchyPaths: [["Fotos", "Städte"]],
            groupType: FileGroupType.Static
        },
        {
            _key: Math.random().toString(36).substring(7),
            name: "Videos",
            ownerId: "1",
            permissionIds: [],
            keywords: [],
            mimeTypes: [],
            groupHierarchyPaths: [],
            groupType: FileGroupType.Static
        },
        {
            _key: Math.random().toString(36).substring(7),
            name: "Musik",
            ownerId: "1",
            permissionIds: [],
            keywords: [],
            mimeTypes: [],
            groupHierarchyPaths: [],
            groupType: FileGroupType.Static
        },
        {
            _key: Math.random().toString(36).substring(7),
            name: "Sterne",
            ownerId: "1",
            permissionIds: [],
            keywords: [],
            mimeTypes: [],
            groupHierarchyPaths: [["Fotos"], ["Favoriten", "2022"]],
            groupType: FileGroupType.Static
        },
        {
            _key: Math.random().toString(36).substring(7),
            name: "Vögel",
            ownerId: "1",
            permissionIds: [],
            keywords: [],
            mimeTypes: [],
            groupHierarchyPaths: [["Fotos", "Tiere"]],
            groupType: FileGroupType.Static
        }
    ];
};

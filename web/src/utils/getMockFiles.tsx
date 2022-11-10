export const getMockFiles = () => {
    const files = [];
    for (let i = 0; i < 506; i++) {
        files.push({
            fileId: Math.random().toString(36).substring(7),
            name: "test",
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
            fileManualGroupIds: ["1"],
            timeOfDeath: 1,
            appData: {
                "1": "1"
            },
            permissionIds: ["1"],
            keywords: ["1"]
        });
    }
    return files;
};

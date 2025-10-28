import {
    createExampleUser,
    FileGroupType,
    FilezClient,
    impersonateUser
} from "filez-client-typescript";

export default async (filezClient: FilezClient) => {
    const alice = await createExampleUser(filezClient);
    const impersonateAliceParams = {
        headers: {
            ...impersonateUser(alice.id)
        }
    };

    const fileGroup = await filezClient.api.createFileGroup(
        {
            file_group_name: `Test File Group`,
            file_group_type: FileGroupType.Manual
        },
        impersonateAliceParams
    );

    const BATCH_SIZE = 100;
    const TOTAL_FILES = 1000;

    const fileIds: string[] = [];

    for (let i = 0; i < TOTAL_FILES; i += BATCH_SIZE) {
        const batchPromises = [];
        const batchEnd = Math.min(i + BATCH_SIZE, TOTAL_FILES);

        for (let j = i; j < batchEnd; j++) {
            batchPromises.push(
                filezClient.api.createFile(
                    {
                        file_name: `Test File ${j}.txt`
                    },
                    impersonateAliceParams
                )
            );
        }

        const all = await Promise.all(batchPromises);
        all.forEach((res) => {
            if (res.data?.data?.created_file) {
                fileIds.push(res.data.data.created_file.id);
            }
        });
        console.log(`Completed batch: ${batchEnd}/${TOTAL_FILES} files`);
    }

    console.log(`All files created successfully.`);

    // add all files to the file group
    await filezClient.api.updateFileGroupMembers({
        file_group_id: fileGroup.data?.data?.created_file_group.id!,
        files_to_add: fileIds
    });

    console.log(fileGroup.data?.data?.created_file_group.id);
};

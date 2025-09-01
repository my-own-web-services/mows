import {
    Api,
    createDefaultStorageQuotaForUser,
    createExampleUser,
    impersonateUser,
    TagResourceType
} from "filez-client-typescript";

export default async (filezClient: Api<unknown>) => {
    const alice = await createExampleUser(filezClient);

    const alice_quota = await createDefaultStorageQuotaForUser(filezClient, alice);

    console.log(
        `Created storage quota: ${alice_quota.id} for Alice(${alice.id}) at location ${alice_quota.storage_location_id}`
    );

    const impersonateAliceParams = {
        headers: {
            ...impersonateUser(alice.id)
        }
    };

    const aliceFiles = [];

    for (let i = 0; i < 10; i++) {
        const fileName = `aliceFile${i}`;
        const createFileResponse = (
            await filezClient.api.createFile(
                { file_name: fileName, mime_type: "text/html" },
                impersonateAliceParams
            )
        ).data?.data;

        if (!createFileResponse) {
            throw new Error(`Failed to create file for Alice: ${fileName}`);
        }
        console.log(`Created file for Alice: ${createFileResponse.created_file.id}`);
        aliceFiles.push(createFileResponse.created_file);
    }

    console.log(`Created ${aliceFiles.length} files for Alice.`);

    // Add tags to Alice's files

    const updateTags = await filezClient.api.updateTags(
        {
            resource_ids: aliceFiles.map((file) => file.id),
            tag_resource_type: TagResourceType.File,
            update_tags: {
                Add: {
                    City: "Berlin",
                    Country: "Germany",
                    Project: "Filez"
                }
            }
        },
        impersonateAliceParams
    );

    if (updateTags.data.status !== "Success") {
        throw new Error("Failed to update tags for Alice's files.");
    }

    const filesMeta = await filezClient.api.getTags(
        {
            resource_ids: aliceFiles.map((file) => file.id),
            tag_resource_type: TagResourceType.File
        },
        impersonateAliceParams
    );

    if (!filesMeta.data?.data) {
        throw new Error("Failed to retrieve files metadata for Alice's files.");
    }
    console.log(`Retrieved files metadata for Alice's files: `);
    console.log(filesMeta.data.data);

    // Check if tags were added correctly
    aliceFiles.forEach((file) => {
        const fileMeta = filesMeta.data.data?.resource_tags[file.id];
        if (!fileMeta) {
            throw new Error(`No metadata found for file: ${file.id}`);
        }
        if (
            !fileMeta ||
            !fileMeta.City ||
            fileMeta.City !== "Berlin" ||
            !fileMeta.Country ||
            fileMeta.Country !== "Germany" ||
            !fileMeta.Project ||
            fileMeta.Project !== "Filez"
        ) {
            throw new Error(
                `Tags not set correctly for file: ${file.id}. Expected tags not found.`
            );
        }
    });

    console.log("Tags added successfully to Alice's files.");

    // remove Tag Berlin from Alice's files
    const removeTags = await filezClient.api.updateTags(
        {
            resource_ids: aliceFiles.map((file) => file.id),
            tag_resource_type: TagResourceType.File,
            update_tags: {
                Remove: {
                    City: "Berlin"
                }
            }
        },
        impersonateAliceParams
    );
    if (removeTags.data.status !== "Success") {
        throw new Error("Failed to remove tags from Alice's files.");
    }
    console.log("Removed tag 'Berlin' from Alice's files.");

    // Check if the tag was removed
    const updatedFilesMeta = await filezClient.api.getTags(
        {
            resource_ids: aliceFiles.map((file) => file.id),
            tag_resource_type: TagResourceType.File
        },
        impersonateAliceParams
    );
    if (!updatedFilesMeta.data?.data) {
        throw new Error("Failed to retrieve updated files metadata for Alice's files.");
    }
    console.log(`Retrieved updated files metadata for Alice's files: `);
    console.log(updatedFilesMeta.data.data);
    aliceFiles.forEach((file) => {
        const fileMeta = updatedFilesMeta.data.data?.resource_tags[file.id];
        if (!fileMeta) {
            throw new Error(`No metadata found for file: ${file.id}`);
        }
        if (fileMeta.City || fileMeta.Country !== "Germany" || fileMeta.Project !== "Filez") {
            throw new Error(
                `Tag 'Berlin' not removed correctly for file: ${file.id}. Expected tags not found.`
            );
        }
    });

    console.log("Tag 'Berlin' removed successfully from Alice's files.");
};

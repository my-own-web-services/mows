import {
    AccessPolicyAction,
    AccessPolicyEffect,
    AccessPolicyResourceType,
    AccessPolicySubjectType,
    Api,
    ContentType,
    FileGroupType
} from "../../api-client";
import { getBlobSha256Digest, impersonateUser } from "../../utils";

export const allroundTest = async (filezClient: Api<unknown>) => {
    console.log("Running all-round test...");

    const aliceEmail = "alice@example.com";
    const bobEmail = "bob@example.com";

    await filezClient.api.listAccessPolicies({});

    await filezClient.api.checkResourceAccess({
        action: AccessPolicyAction.UsersDelete,
        resource_type: AccessPolicyResourceType.User
    });

    // Ensure first that the users Alice and Bob don't already exist
    await filezClient.api
        .deleteUser({
            method: {
                ByEmail: aliceEmail
            }
        })
        .catch((response) => {
            if (response?.status !== 404) {
                throw `Failed to delete user Alice: ${response.message}`;
            }
        });

    await filezClient.api
        .deleteUser({
            method: {
                ByEmail: bobEmail
            }
        })
        .catch((response) => {
            if (response?.status !== 404) {
                throw `Failed to delete user Bob: ${response.message}`;
            }
        });

    const alice = (await filezClient.api.createUser({ email: aliceEmail })).data?.data;
    const bob = (await filezClient.api.createUser({ email: bobEmail })).data?.data;

    if (!alice || !bob) {
        throw new Error("Failed to create users Alice and Bob.");
    }
    console.log(`Created users: Alice (${alice.id}), Bob (${bob.id})`);

    const storage_locations = (await filezClient.api.listStorageLocations({})).data?.data
        ?.storage_locations;

    if (storage_locations?.length === 0) {
        throw new Error("No storage locations found. Please create a storage location first.");
    } else if (storage_locations?.length !== undefined && storage_locations?.length > 1) {
        console.warn("Multiple storage locations found. Using the first one.");
    }

    const storage_location_id = storage_locations?.[0].id;

    if (!storage_location_id) {
        throw new Error("No storage location ID found. Please create a storage location first.");
    }

    // Create a storage quota for Alice
    const alice_quota = (
        await filezClient.api.createStorageQuota({
            quota_bytes: 10_000_000,
            subject_type: AccessPolicySubjectType.User,
            subject_id: alice.id,
            storage_location_id,
            name: "Alice's Storage Quota"
        })
    ).data?.data?.storage_quota;

    if (!alice_quota) {
        throw new Error("Failed to create storage quota for Alice.");
    }

    console.log(
        `Created storage quota: ${alice_quota.id} for Alice(${alice.id}) at location ${storage_location_id}`
    );

    // Impersonate Alice

    const impersonateAliceParams = {
        headers: {
            ...impersonateUser(alice.id)
        }
    };

    // Impersonate Bob
    const impersonateBobParams = {
        headers: {
            ...impersonateUser(bob.id)
        }
    };

    const aliceFileResponse = (
        await filezClient.api.createFile(
            { file_name: "aliceFile1", mime_type: "text/html" },
            impersonateAliceParams
        )
    ).data?.data;

    if (!aliceFileResponse) {
        throw new Error("Failed to create file for Alice.");
    }
    console.log(`Created file for Alice: ${aliceFileResponse.created_file.id}`);

    // Create a file version for Alice's file

    const aliceFileVersionContent = new Blob(
        [
            `<!DOCTYPE html>
<html>
<body>

<h1>My First Heading</h1>

<p>My first paragraph.</p>

</body>
</html>

`
        ],
        { type: "text/html" }
    );

    const aliceFileVersion = (
        await filezClient.api.createFileVersion(
            {
                file_id: aliceFileResponse.created_file.id,
                metadata: {},
                size: aliceFileVersionContent.size,
                storage_quota_id: alice_quota.id,
                content_expected_sha256_digest: await getBlobSha256Digest(aliceFileVersionContent)
            },
            impersonateAliceParams
        )
    ).data?.data;

    if (!aliceFileVersion) {
        throw new Error("Failed to create file version for Alice's file.");
    }

    // first upload only the first 50 bytes of the content

    const firstAliceFileVersionContent = aliceFileVersionContent.slice(0, 50);

    const firstUpload = await filezClient.api.fileVersionsContentTusPatch(
        aliceFileResponse.created_file.id,
        aliceFileVersion.version.version,
        firstAliceFileVersionContent,
        {
            headers: {
                "Tus-Resumable": "1.0.0",
                "Upload-Offset": "0",
                ...impersonateAliceParams.headers
            },
            type: ContentType.BinaryWithOffset
        }
    );

    if (!firstUpload) {
        throw new Error("Failed to upload content for Alice's file version.");
    }
    console.log(
        `Uploaded first half of content for Alice's file version: ${aliceFileVersion.version}`
    );

    // Now upload the rest of the content

    const secondAliceFileVersionContent = aliceFileVersionContent.slice(50);
    const secondUpload = await filezClient.api.fileVersionsContentTusPatch(
        aliceFileResponse.created_file.id,
        aliceFileVersion.version.version,
        secondAliceFileVersionContent,
        {
            headers: {
                "Tus-Resumable": "1.0.0",
                "Upload-Offset": firstAliceFileVersionContent.size.toString(),
                ...impersonateAliceParams.headers
            },
            type: ContentType.BinaryWithOffset
        }
    );
    if (!secondUpload) {
        throw new Error("Failed to upload second half of content for Alice's file version.");
    }
    console.log(
        `Uploaded second half of content for Alice's file version: ${aliceFileVersion.version}`
    );

    const content = await (
        await filezClient.api.getFileVersionContent(
            aliceFileResponse.created_file.id,
            null,
            null,
            null,
            null,
            null,
            impersonateAliceParams
        )
    ).blob();

    if (!content) {
        throw new Error("Failed to get content for Alice's file version.");
    }

    if (aliceFileVersionContent.size !== content.size) {
        throw new Error(
            "Content size mismatch for Alice's file version. Expected: " +
                aliceFileVersionContent.size +
                ", got: " +
                content.size
        );
    }

    const aliceUpdatedFileVersionContentTooBig = new Blob(
        [
            `<!DOCTYPE html>
<html>
<body>

<h1>My First Heading</h1>
<h1>My First Heading</h1>

<p>My first paragraph.</p>

</body>
</html>

`
        ],
        { type: "text/html" }
    );

    const updateUploadTooBig = await filezClient.api
        .fileVersionsContentTusPatch(
            aliceFileResponse.created_file.id,
            aliceFileVersion.version.version,
            aliceUpdatedFileVersionContentTooBig,
            {
                headers: {
                    "Tus-Resumable": "1.0.0",
                    "Upload-Offset": "0",
                    ...impersonateAliceParams.headers
                },
                type: ContentType.BinaryWithOffset
            }
        )
        .catch((response) => {
            if (response?.status !== 413) {
                throw new Error(
                    "Failed to update content for Alice's file version. Expected 413, got: " +
                        response.status
                );
            }
        });

    if (updateUploadTooBig) {
        throw new Error(
            "Expected an error when trying to update content for Alice's file version with a larger size."
        );
    }

    const aliceUpdatedFileVersionContent = new Blob([`Hi!`], { type: "text/html" });

    const updateUploadAlreadyValid = await filezClient.api
        .fileVersionsContentTusPatch(
            aliceFileResponse.created_file.id,
            aliceFileVersion.version.version,
            aliceUpdatedFileVersionContent,
            {
                headers: {
                    "Tus-Resumable": "1.0.0",
                    "Upload-Offset": "0",
                    ...impersonateAliceParams.headers
                },
                type: ContentType.BinaryWithOffset
            }
        )
        .catch((response) => {
            if (response?.status !== 400) {
                throw new Error(
                    "The content update for Alice's file version should not be valid, expected 400, got: " +
                        response.status
                );
            }
            console.log(
                "Correctly caught the error when trying to update content for Alice's file version with an already valid size."
            );
        });
    if (updateUploadAlreadyValid) {
        throw new Error(
            "Expected an error when trying to update content for Alice's file version with an already valid size."
        );
    }
    console.log("Successfully failed to update content for Alice's file version.");

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

    // Create a file group for Alice
    const aliceFileGroup1 = (
        await filezClient.api.createFileGroup({
            name: "Alice's File Group 1",
            group_type: FileGroupType.Manual,
            dynamic_group_rule: null
        })
    ).data?.data;

    if (!aliceFileGroup1) {
        throw new Error("Failed to create file group for Alice.");
    }

    console.log(`Created file group for Alice: ${aliceFileGroup1.id}`);

    const aliceFileGroup2 = (
        await filezClient.api.createFileGroup({
            name: "Alice's File Group 2",
            group_type: FileGroupType.Manual,
            dynamic_group_rule: null
        })
    ).data?.data;
    if (!aliceFileGroup2) {
        throw new Error("Failed to create second file group for Alice.");
    }
    console.log(`Created second file group for Alice: ${aliceFileGroup2.id}`);

    // Add files to the first file group

    const filesToAddToGroup1 = aliceFiles.slice(0, 7);
    const addFilesToGroup1 = await filezClient.api.updateFileGroupMembers({
        file_group_id: aliceFileGroup1.id,
        files_to_add: filesToAddToGroup1.map((file) => file.id),
        files_to_remove: []
    });
    if (!addFilesToGroup1) {
        throw new Error("Failed to add files to Alice's first file group.");
    }
    console.log(
        `Added ${filesToAddToGroup1.length} files to Alice's first file group: ${aliceFileGroup1.id}`
    );

    // Add files to the second file group

    const filesToAddToGroup2 = aliceFiles.slice(7, 10);
    const addFilesToGroup2 = await filezClient.api.updateFileGroupMembers({
        file_group_id: aliceFileGroup2.id,
        files_to_add: filesToAddToGroup2.map((file) => file.id),
        files_to_remove: []
    });
    if (!addFilesToGroup2) {
        throw new Error("Failed to add files to Alice's second file group.");
    }
    console.log(
        `Added ${filesToAddToGroup2.length} files to Alice's second file group: ${aliceFileGroup2.id}`
    );

    // List files in the first file group
    const listFilesInGroup1 = (
        await filezClient.api.listFilesByFileGroups({
            file_group_id: aliceFileGroup1.id
        })
    ).data?.data?.files;
    if (!listFilesInGroup1) {
        throw new Error("Failed to list files in Alice's first file group.");
    }

    console.log(
        `Listed ${listFilesInGroup1.length} files in Alice's first file group: ${aliceFileGroup1.id}`
    );

    const listFilesInGroup2 = (
        await filezClient.api.listFilesByFileGroups({
            file_group_id: aliceFileGroup2.id
        })
    ).data?.data?.files;

    if (!listFilesInGroup2) {
        throw new Error("Failed to list files in Alice's second file group.");
    }
    console.log(
        `Listed ${listFilesInGroup2.length} files in Alice's second file group: ${aliceFileGroup2.id}`
    );

    // try to list files in the first file group as Bob
    const bobListFilesInGroup1BeforePolicyCreation = await filezClient.api
        .listFilesByFileGroups(
            {
                file_group_id: aliceFileGroup1.id
            },
            impersonateBobParams
        )
        .catch((response) => {
            if (response?.status !== 403) {
                throw new Error(
                    `Bob should not be able to list files in Alice's first file group, expected 403, got: ${response.status}`
                );
            }
            console.log(
                "Correctly caught the error when Bob tried to list files in Alice's first file group before policy creation."
            );
        });

    if (bobListFilesInGroup1BeforePolicyCreation) {
        throw new Error(
            "Expected an error when Bob tried to list files in Alice's first file group."
        );
    }

    // Create an access rule that allows Bob to list files in Alice's first file group
    const accessRule = (
        await filezClient.api.createAccessPolicy(
            {
                subject_type: AccessPolicySubjectType.User,
                subject_id: bob.id,
                actions: [AccessPolicyAction.FileGroupsListFiles],
                resource_type: AccessPolicyResourceType.FileGroup,
                resource_id: aliceFileGroup1.id,
                effect: AccessPolicyEffect.Allow,
                context_app_id: "00000000-0000-0000-0000-000000000000",
                name: "Allow Bob to list files in Alice's first file group"
            },
            impersonateAliceParams
        )
    ).data?.data;
    if (!accessRule) {
        throw new Error("Failed to create access rule for Bob.");
    }
    console.log(
        `Created access rule for Bob: ${accessRule.id} to list files in Alice's first file group: ${aliceFileGroup1.id}`
    );

    // Try to list files in Alice's first file group
    const bobListFilesInGroup1 = (
        await filezClient.api.listFilesByFileGroups(
            {
                file_group_id: aliceFileGroup1.id
            },
            impersonateBobParams
        )
    ).data?.data?.files;
    if (!bobListFilesInGroup1) {
        throw new Error("Bob failed to list files in Alice's first file group.");
    }
    console.log(
        `Bob listed ${bobListFilesInGroup1.length} files in Alice's first file group: ${aliceFileGroup1.id}`
    );
    // Try to delete files in Alice's first file group, should fail
    const bobDeleteFilesInGroup1 = await filezClient.api
        .deleteFileGroup(aliceFileGroup1.id, impersonateBobParams)
        .catch((response) => {
            if (response?.status !== 403) {
                throw new Error(
                    `Bob should not be able to delete files in Alice's first file group, expected 403, got: ${response.status}`
                );
            }
            console.log(
                "Correctly caught the error when Bob tried to delete files in Alice's first file group."
            );
        });
    if (bobDeleteFilesInGroup1) {
        throw new Error(
            "Expected an error when Bob tried to delete files in Alice's first file group."
        );
    }
    console.log("Bob correctly failed to delete files in Alice's first file group.");

    // Try to list files in Alice's second file group (should fail)
    const bobListFilesInGroup2 = await filezClient.api
        .listFilesByFileGroups(
            {
                file_group_id: aliceFileGroup2.id
            },
            impersonateBobParams
        )
        .catch((response) => {
            if (response?.status !== 403) {
                throw new Error(
                    `Bob should not be able to list files in Alice's second file group, expected 403, got: ${response.status}`
                );
            }
            console.log(
                "Correctly caught the error when Bob tried to list files in Alice's second file group."
            );
        });
    if (bobListFilesInGroup2) {
        throw new Error(
            "Expected an error when Bob tried to list files in Alice's second file group."
        );
    }

    console.log("Bob correctly failed to list files in Alice's second file group.");
    console.log("All-round-10 test completed successfully.");
};

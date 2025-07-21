import {
    AccessPolicyAction,
    AccessPolicyResourceType,
    AccessPolicySubjectType,
    Api,
    ContentType
} from "../api-client";
import { getBlobSha256Digest, impersonateUser } from "../utils";

export const runTests = async (filezClient: Api<unknown>) => {
    console.log("Running API tests...");

    await allroundTest(filezClient);

    console.log("API tests completed.");
};

const allroundTest = async (filezClient: Api<unknown>) => {
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

    const aliceFile = (
        await filezClient.api.createFile(
            { file_name: "aliceFile1", mime_type: "text/html" },
            impersonateAliceParams
        )
    ).data?.data;

    if (!aliceFile) {
        throw new Error("Failed to create file for Alice.");
    }
    console.log(`Created file for Alice: ${aliceFile.id}`);

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
                file_id: aliceFile.id,
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

    const upload = await filezClient.api.fileVersionsContentTusPatch(
        aliceFile.id,
        aliceFileVersion.version.version,
        aliceFileVersionContent,
        {
            headers: {
                "Tus-Resumable": "1.0.0",
                "Upload-Offset": "0",
                ...impersonateAliceParams.headers
            },
            type: ContentType.BinaryWithOffset
        }
    );

    if (!upload) {
        throw new Error("Failed to upload content for Alice's file version.");
    }
    console.log(`Uploaded content for Alice's file version: ${aliceFileVersion.version}`);

    const content = await (
        await filezClient.api.getFileVersionContent(
            aliceFile.id,
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
            aliceFile.id,
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

    const updateUpload = await filezClient.api.fileVersionsContentTusPatch(
        aliceFile.id,
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
    );
    if (!updateUpload) {
        throw new Error("Failed to update content for Alice's file version.");
    }

    const updatedContent = await (
        await filezClient.api.getFileVersionContent(
            aliceFile.id,
            null,
            null,
            null,
            null,
            null,
            impersonateAliceParams
        )
    ).blob();
};

// update the content

// create 10 files
// create multiple versions for all 10 files
// update the metadata for the 10 files

// create 2 file groups
// add the 10 files to the file groups random 7 into the first 3 in the second
// list the files of the file groups
// create a access rule that allows the listing of files in the file group to bob

// impersonate bob
// try to list the files in the file group
// try to delete the files in the file group

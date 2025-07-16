import {
    AccessPolicyAction,
    AccessPolicyResourceType,
    AccessPolicySubjectType,
    Api
} from "../api-client";
import { impersonateUser } from "../utils";

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
        action: AccessPolicyAction.FilezUsersDelete,
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
    await filezClient.api.createStorageQuota({
        ignore_quota: false,
        quota_bytes: 10_000_000,
        subject_type: AccessPolicySubjectType.User,
        subject_id: alice.id,
        storage_location_id
    });

    console.log(`Created storage quota for Alice (${alice.id}) at location ${storage_location_id}`);

    // Impersonate Alice

    const impersonateAliceParams = {
        headers: {
            ...impersonateUser(alice.id)
        }
    };

    const aliceFile = (
        await filezClient.api.createFile(
            { file_name: "aliceFile1", mime_type: "text/plain" },
            impersonateAliceParams
        )
    ).data?.data;

    if (!aliceFile) {
        throw new Error("Failed to create file for Alice.");
    }
    console.log(`Created file for Alice: ${aliceFile.id}`);

    // Create a file version for Alice's file

    const aliceFileVersionContent = new Blob(["Hello, Alice!"], { type: "text/plain" });

    const aliceFileVersion = (
        await filezClient.api.createFileVersion(
            {
                file_id: aliceFile.id,
                metadata: {},
                size: aliceFileVersionContent.size,
                storage_location_id
            },
            impersonateAliceParams
        )
    ).data?.data;

    if (!aliceFileVersion) {
        throw new Error("Failed to create file version for Alice's file.");
    }

    const upload = await filezClient.api.fileVersionsContentTusPatch(
        aliceFile.id,
        aliceFileVersion.version,
        aliceFileVersionContent,
        impersonateAliceParams
    );

    if (!upload) {
        throw new Error("Failed to upload content for Alice's file version.");
    }
    console.log(`Uploaded content for Alice's file version: ${aliceFileVersion.version}`);

    const content = (
        await filezClient.api.getFileVersionContent(
            aliceFile.id,
            aliceFileVersion.version,
            null,
            null,
            null,
            null,
            impersonateAliceParams
        )
    ).data;
};

// get the content for this version
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

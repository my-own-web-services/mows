import { AccessPolicySubjectType, Api } from "../../api-client";
import { getBlobSha256Digest, impersonateUser } from "../../utils";

export default async (filezClient: Api<unknown>) => {
    console.log("Running storage quota test");

    const aliceEmail = "alice@example.com";

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

    const alice = (await filezClient.api.createUser({ email: aliceEmail })).data?.data;

    if (!alice) {
        throw "Failed to create user Alice";
    }

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

    const alice_quota = (
        await filezClient.api.createStorageQuota({
            quota_bytes: 100,
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

    const impersonateAliceParams = {
        headers: {
            ...impersonateUser(alice.id)
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

    const aliceFileVersionContent = new Blob(
        [
            `<!DOCTYPE html>
<html>
<body>
<h1>My First Heading</h1>

<p>My first paragraph.</p>

</body>
</html>`
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
    ).data?.data?.version;

    if (!aliceFileVersion) {
        throw new Error("Failed to create file version for Alice's file.");
    }
};

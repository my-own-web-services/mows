import { Api } from "../../api-client";
import { createDefaultStorageQuotaForUser, createExampleUser, impersonateUser } from "../../utils";

export default async (filezClient: Api<unknown>) => {
    const alice = await createExampleUser(filezClient);

    const alice_quota = await createDefaultStorageQuotaForUser(filezClient, alice, 100);

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

    const aliceFileVersion1ShouldFail = await filezClient.api
        .createFileVersion(
            {
                file_id: aliceFileResponse.created_file.id,
                file_version_metadata: {},
                file_version_size: 200,
                storage_quota_id: alice_quota.id,
                file_version_mime_type: "text/html"
            },
            impersonateAliceParams
        )
        .catch((response) => {
            if (response?.status !== 403) {
                throw new Error(
                    `Unexpected error when creating file version for Alice: ${response.message}`
                );
            }
            console.log(
                "Expected error when creating file version for Alice due to storage quota."
            );
            return null; // Return null to indicate the expected failure
        });

    if (aliceFileVersion1ShouldFail) {
        throw new Error("File version creation for Alice should have failed due to storage quota.");
    }

    // try to create 2 file versions for alice withing the storage quota the third file should fail

    const aliceFileVersion2ShouldWork = (
        await filezClient.api.createFileVersion(
            {
                file_id: aliceFileResponse.created_file.id,
                file_version_metadata: {},
                file_version_size: 50,
                storage_quota_id: alice_quota.id,
                file_version_mime_type: "text/html"
            },
            impersonateAliceParams
        )
    ).data?.data?.created_file_version;

    if (!aliceFileVersion2ShouldWork) {
        throw new Error("Failed to create second file version for Alice.");
    }

    console.log(`Created second file version for Alice: ${aliceFileVersion2ShouldWork.id}`);

    const aliceFileVersion3ShouldWork = (
        await filezClient.api.createFileVersion(
            {
                file_id: aliceFileResponse.created_file.id,
                file_version_metadata: {},
                file_version_size: 40,
                storage_quota_id: alice_quota.id,
                file_version_mime_type: "text/html"
            },
            impersonateAliceParams
        )
    ).data?.data?.created_file_version;
    if (!aliceFileVersion3ShouldWork) {
        throw new Error("Failed to create third file version for Alice.");
    }
    console.log(`Created third file version for Alice: ${aliceFileVersion3ShouldWork.id}`);

    const aliceFileVersion4ShouldFail = await filezClient.api
        .createFileVersion(
            {
                file_id: aliceFileResponse.created_file.id,
                file_version_metadata: {},
                file_version_size: 50,
                storage_quota_id: alice_quota.id,
                file_version_mime_type: "text/html"
            },
            impersonateAliceParams
        )
        .catch((response) => {
            if (response?.status !== 403) {
                throw new Error(
                    `Unexpected error when creating third file version for Alice: ${response.message}`
                );
            }
            console.log(
                "Expected error when creating third file version for Alice due to storage quota."
            );
            return null; // Return null to indicate the expected failure
        });
    if (aliceFileVersion4ShouldFail) {
        throw new Error(
            "Third file version creation for Alice should have failed due to storage quota."
        );
    }

    await filezClient.api.deleteFileVersions(
        aliceFileVersion3ShouldWork.id,
        impersonateAliceParams
    );

    console.log(
        `Deleted file version for Alice: ${aliceFileVersion3ShouldWork.id} to free up space in storage quota`
    );

    const aliceFileVersion4ShouldWork = (
        await filezClient.api.createFileVersion(
            {
                file_id: aliceFileResponse.created_file.id,
                file_version_metadata: {},
                file_version_size: 50,
                storage_quota_id: alice_quota.id,
                file_version_mime_type: "text/html"
            },
            impersonateAliceParams
        )
    ).data?.data?.created_file_version;
    if (!aliceFileVersion4ShouldWork) {
        throw new Error("Failed to create fourth file version for Alice after deleting one.");
    }
};

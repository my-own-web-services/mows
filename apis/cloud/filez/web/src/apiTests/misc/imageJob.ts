import { AccessPolicySubjectType, Api, ContentType, JobPersistenceType } from "../../api-client";
import { impersonateUser } from "../../utils";

export default async (filezClient: Api<unknown>) => {
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
        throw new Error("Failed to create users Alice and Bob.");
    }
    console.log(`Created users: Alice (${alice.id})`);

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

    const apps = (await filezClient.api.listApps({})).data?.data?.apps;

    if (!apps || apps.length === 0) {
        throw new Error("No apps found. Please create an app first.");
    }

    const imageApp = apps.find(
        (app) => app.name === "mows-core-storage-filez-filez-apps-backend-images"
    );

    if (!imageApp) {
        throw new Error(
            "Image processing app not found. Please create the image processing app first."
        );
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

    const impersonateAliceParams = {
        headers: {
            ...impersonateUser(alice.id)
        }
    };

    const aliceFile = (
        await filezClient.api.createFile(
            {
                file_name: "test-image-job.jpg",
                mime_type: "image/jpeg"
            },
            impersonateAliceParams
        )
    ).data?.data;

    if (!aliceFile) {
        throw new Error("Failed to create file for Alice.");
    }

    console.log(`Created file for Alice: ${aliceFile.created_file.id}`);

    const image_response = await fetch(
        "https://upload.wikimedia.org/wikipedia/commons/0/00/El_Gato.jpg"
    );

    const aliceFileVersion = (
        await filezClient.api.createFileVersion(
            {
                file_id: aliceFile.created_file.id,
                mime_type: "image/jpeg",
                metadata: {},
                size: parseInt(image_response.headers.get("content-length") || "0"),
                storage_quota_id: alice_quota.id
            },
            impersonateAliceParams
        )
    ).data?.data?.version;

    if (!aliceFileVersion) {
        throw new Error("Failed to create file version for Alice.");
    }

    const blob = await image_response.blob();

    const uploadFileRes = await filezClient.api.fileVersionsContentTusPatch(
        aliceFile.created_file.id,
        aliceFileVersion.version,
        null,
        blob,
        {
            headers: {
                "Tus-Resumable": "1.0.0",
                "Upload-Offset": "0",
                ...impersonateAliceParams.headers
            },
            type: ContentType.BinaryWithOffset
        }
    );

    const job = await filezClient.api.createJob(
        {
            app_id: imageApp.id,
            name: "Image conversion job",
            persistence: JobPersistenceType.Temporary,
            execution_details: {
                job_type: {
                    CreatePreview: {
                        allowed_mime_types: ["image/avif"],
                        file_id: aliceFile.created_file.id,
                        allowed_number_of_previews: 2,
                        allowed_size_bytes: 10_000_000,
                        file_version_number: aliceFileVersion.version,
                        storage_location_id: storage_location_id,
                        storage_quota_id: alice_quota.id,
                        preview_config: {
                            widths: [100, 250],
                            formats: ["Avif"]
                        }
                    }
                }
            }
        },
        impersonateAliceParams
    );

    //  wait for the job to complete
    const jobId = job.data?.data?.created_job.id;
    if (!jobId) {
        throw new Error("Failed to create job for image processing.");
    }
    console.log(`Created job for image processing: ${jobId}`);

    let successfullyCompleted = false;

    loop1: for (let i = 0; i < 10; i++) {
        const content = await filezClient.api
            .getFileVersionContent(
                aliceFile.created_file.id,
                aliceFileVersion.version,
                imageApp.id,
                "250.avif",
                undefined,
                impersonateAliceParams
            )
            .catch((error) => {
                if (error?.status !== 404) {
                    throw new Error(`Failed to get file version content: ${error.message}`);
                }
                console.warn(`Attempt ${i + 1}: File version content not found, retrying...`);
                return null; // If the file is not found, return null
            });

        if (content) {
            console.log(`File version content retrieved successfully`);
            successfullyCompleted = true;

            await filezClient.api.getFileVersions(
                {
                    versions: [
                        {
                            app_id: imageApp.id,
                            file_id: aliceFile.created_file.id,
                            version: aliceFileVersion.version,
                            app_path: "250.avif"
                        }
                    ]
                },
                impersonateAliceParams
            );

            break loop1;
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    if (!successfullyCompleted) {
        throw new Error("Failed to retrieve file version content after 10 attempts.");
    }
    console.log("File version content retrieved successfully");
};

import {
    Api,
    ContentType,
    createExampleUser,
    impersonateUser,
    JobPersistenceType,
    StorageQuotaSubjectType
} from "filez-client-typescript";

export default async (filezClient: Api<unknown>) => {
    const alice = await createExampleUser(filezClient);
    console.log(`Created users: Alice (${alice.id})`);

    const storage_locations = (await filezClient.api.listStorageLocations({})).data?.data
        ?.storage_locations;

    if (storage_locations?.length === 0) {
        throw new Error(`No storage locations found. Please create a storage location first.`);
    } else if (storage_locations?.length !== undefined && storage_locations?.length > 1) {
        console.warn(`Multiple storage locations found. Using the first one.`);
    }

    const storage_location_id = storage_locations?.[0].id;

    if (!storage_location_id) {
        throw new Error(`No storage location ID found. Please create a storage location first.`);
    }

    const apps = (await filezClient.api.listApps({})).data?.data?.apps;

    if (!apps || apps.length === 0) {
        throw new Error(`No apps found. Please create an app first.`);
    }

    const metadataApp = apps.find(
        (app) => app.name === `mows-core-storage-filez-filez-apps-backend-metadata`
    );

    if (!metadataApp) {
        throw new Error(
            `Metadata processing app not found. Please create the metadata processing app first.`
        );
    }

    // Create a storage quota for Alice
    const alice_quota = (
        await filezClient.api.createStorageQuota({
            storage_quota_bytes: 10_000_000,
            storage_quota_subject_type: StorageQuotaSubjectType.User,
            storage_quota_subject_id: alice.id,
            storage_location_id,
            storage_quota_name: `Alice's Storage Quota`
        })
    ).data?.data?.created_storage_quota;

    if (!alice_quota) {
        throw new Error(`Failed to create storage quota for Alice.`);
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
                file_name: `test-metadata-job.jpg`,
                mime_type: `image/jpeg`
            },
            impersonateAliceParams
        )
    ).data?.data;

    if (!aliceFile) {
        throw new Error(`Failed to create file for Alice.`);
    }

    console.log(`Created file for Alice: ${aliceFile.created_file.id}`);

    const image_response = await fetch(
        `https://upload.wikimedia.org/wikipedia/commons/4/49/2019-04-06_Dieter_M._Weidenbach_StP_4058_by_Stepro.jpg`
    );

    const aliceFileVersion = (
        await filezClient.api.createFileVersion(
            {
                file_id: aliceFile.created_file.id,
                file_version_mime_type: `image/jpeg`,
                file_version_metadata: {},
                file_version_content_size_bytes: parseInt(
                    image_response.headers.get(`content-length`) || `0`
                ),
                storage_quota_id: alice_quota.id
            },
            impersonateAliceParams
        )
    ).data?.data?.created_file_version;

    if (!aliceFileVersion) {
        throw new Error(`Failed to create file version for Alice.`);
    }

    const blob = await image_response.blob();

    const _uploadFileRes = await filezClient.api.fileVersionsContentPatch(
        aliceFile.created_file.id,
        aliceFileVersion.file_revision_index,
        null,
        {
            upload_offset: 0
        },
        blob,
        {
            headers: {
                ...impersonateAliceParams.headers
            },
            type: ContentType.BinaryWithOffset
        }
    );

    const job = await filezClient.api.createJob(
        {
            job_handling_app_id: metadataApp.id,
            job_name: `Metadata extraction job`,
            job_persistence: JobPersistenceType.Temporary,
            job_priority: 5,
            job_execution_details: {
                job_type: {
                    ExtractMetadata: {
                        file_id: aliceFile.created_file.id,
                        file_revision_index: aliceFileVersion.file_revision_index,
                        extract_metadata_config: {}
                    }
                }
            }
        },
        impersonateAliceParams
    );

    //  wait for the job to complete
    const jobId = job.data?.data?.created_job.id;
    if (!jobId) {
        throw new Error(`Failed to create job for metadata processing.`);
    }
    console.log(`Created job for image processing: ${jobId}`);

    // Wait for job to complete then fetch the file

    let successfullyCompleted = false;

    for (let i = 0; i < 10; i++) {
        const job = await filezClient.api.getJob({ job_id: jobId }, impersonateAliceParams);
        console.log(`Job status: ${job.data?.data?.job.status}`);
        if (job.data?.data?.job.status === `Completed`) {
            successfullyCompleted = true;
            break;
        } else if (job.data?.data?.job.status === `Failed`) {
            throw new Error(`Job failed: ${job.data?.data?.job.status_details}`);
        }

        await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    if (!successfullyCompleted) {
        throw new Error(`Job did not complete successfully within the expected time.`);
    }

    const updatedFile = await filezClient.api.getFiles(
        { file_ids: [aliceFile.created_file.id] },
        impersonateAliceParams
    );

    console.log(
        `Fetched updated file for Alice: ${JSON.stringify(
            updatedFile.data?.data?.files[0],
            null,
            2
        )}`
    );
};

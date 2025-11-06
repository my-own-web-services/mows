import {
    ContentType,
    FilezClient,
    getBlobSha256Digest,
    JobPersistenceType,
    StorageQuota
} from "filez-client-typescript";

export type UploadFileResponse = Record<string, never>;

export interface UploadFileRequest {
    file: File;
    name?: string;
    mimeType?: string;
}

export interface UploadProgressData {
    loaded: number;
    total: number;
    percentage: number;
    phase: `preparing` | `uploading` | `completed`;
}

export const handleFileUpload = async (
    filezClient: FilezClient,
    storageQuota: StorageQuota,
    fileToUpload: UploadFileRequest,
    addToFileGroupId?: string,
    createPreviews?: boolean,
    onProgress?: (progress: UploadProgressData) => void
): Promise<UploadFileResponse> => {
    const mimeType = fileToUpload.mimeType || fileToUpload.file.type;

    onProgress?.({
        loaded: 0,
        total: fileToUpload.file.size,
        percentage: 0,
        phase: `preparing`
    });

    const createFileResponse = (
        await filezClient.api.createFile({
            file_name: fileToUpload.name || fileToUpload.file.name,
            mime_type: mimeType
        })
    ).data?.data;

    if (!createFileResponse?.created_file) {
        throw new Error(`Failed to create file: ${JSON.stringify(createFileResponse)}`);
    }

    if (addToFileGroupId) {
        const addToFileGroupResponse = await filezClient.api.updateFileGroupMembers({
            file_group_id: addToFileGroupId,
            files_to_add: [createFileResponse.created_file.id]
        });
        if (addToFileGroupResponse.status !== 200) {
            throw new Error(
                `Failed to add file to file group: ${addToFileGroupResponse.statusText}`
            );
        }
    }

    const fileVersionResponse = (
        await filezClient.api.createFileVersion({
            file_id: createFileResponse.created_file.id,
            file_version_metadata: {},
            file_version_content_size_bytes: fileToUpload.file.size,
            storage_quota_id: storageQuota.id,
            content_expected_sha256_digest: await getBlobSha256Digest(fileToUpload.file),
            file_version_mime_type: mimeType
        })
    ).data?.data?.created_file_version;

    if (!fileVersionResponse) {
        throw new Error(`Failed to create file version: ${JSON.stringify(fileVersionResponse)}`);
    }

    const maxChunkSize = 100 * 1024 * 1024; // 100MB
    let offset = 0;

    onProgress?.({
        loaded: 0,
        total: fileToUpload.file.size,
        percentage: 0,
        phase: `uploading`
    });

    while (offset < fileToUpload.file.size) {
        const chunk = fileToUpload.file.slice(offset, offset + maxChunkSize);
        const uploadResponse = await filezClient.api.fileVersionsContentPatch(
            createFileResponse.created_file.id,
            fileVersionResponse.file_revision_index,
            null,
            {
                upload_offset: offset
            },
            chunk,
            {
                type: ContentType.BinaryWithOffset
            }
        );
        if (uploadResponse.status !== 200) {
            throw new Error(
                `Failed to upload chunk at offset ${offset}: ${uploadResponse.statusText}`
            );
        }
        offset += chunk.size;

        onProgress?.({
            loaded: offset,
            total: fileToUpload.file.size,
            percentage: Math.round((offset / fileToUpload.file.size) * 100),
            phase: `uploading`
        });
    }

    if (createPreviews) {
        const apps = await filezClient.api.listApps({});

        const previewGeneratorApp = apps.data?.data?.apps.find(
            (app) => app.name === `mows-core-storage-filez-filez-apps-backend-images`
        );

        if (!previewGeneratorApp) {
            throw new Error(`Preview generator app not found`);
        }

        await filezClient.api.createJob({
            job_execution_details: {
                job_type: {
                    CreatePreview: {
                        file_id: createFileResponse.created_file.id,
                        file_revision_index: fileVersionResponse.file_revision_index,
                        storage_location_id: fileVersionResponse.storage_location_id,
                        storage_quota_id: storageQuota.id,
                        allowed_number_of_previews: 3,
                        allowed_size_bytes: 10_000_000,
                        allowed_mime_types: [`image/avif`],
                        preview_config: {
                            widths: [500],
                            formats: [`Avif`],
                            speed: 10
                        }
                    }
                }
            },
            job_handling_app_id: previewGeneratorApp?.id,
            job_name: `Generate Fast Previews for ${createFileResponse.created_file.name}`,
            job_persistence: JobPersistenceType.Temporary,
            job_priority: 10
        });

        await filezClient.api.createJob({
            job_execution_details: {
                job_type: {
                    CreatePreview: {
                        file_id: createFileResponse.created_file.id,
                        file_revision_index: fileVersionResponse.file_revision_index,
                        storage_location_id: fileVersionResponse.storage_location_id,
                        storage_quota_id: storageQuota.id,
                        allowed_number_of_previews: 3,
                        allowed_size_bytes: 10_000_000,
                        allowed_mime_types: [`image/avif`],

                        preview_config: {
                            widths: [100, 250, 500, 1000],
                            formats: [`Avif`],
                            speed: 1
                        }
                    }
                }
            },
            job_handling_app_id: previewGeneratorApp?.id,
            job_name: `Generate well compressed Previews for ${createFileResponse.created_file.name}`,
            job_persistence: JobPersistenceType.Temporary,
            job_priority: 1
        });
    }

    onProgress?.({
        loaded: fileToUpload.file.size,
        total: fileToUpload.file.size,
        percentage: 100,
        phase: `completed`
    });

    return {};
};

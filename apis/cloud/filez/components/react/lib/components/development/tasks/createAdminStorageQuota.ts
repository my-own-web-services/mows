import { Api, StorageQuotaSubjectType } from "filez-client-typescript";
import { log } from "mows-components-react/lib/logging";

export default async (filezClient: Api<unknown>) => {
    const ownUser = (await filezClient.api.getOwnUser({})).data?.data?.user;

    if (!ownUser) {
        throw new Error(`Failed to get own user.`);
    }

    const storage_locations = (await filezClient.api.listStorageLocations({})).data?.data
        ?.storage_locations;

    if (storage_locations?.length === 0) {
        throw new Error(`No storage locations found. Please create a storage location first.`);
    } else if (storage_locations?.length !== undefined && storage_locations?.length > 1) {
        log.warn(`Multiple storage locations found. Using the first one.`);
    }

    const storage_location_id = storage_locations?.[0].id;

    if (!storage_location_id) {
        throw new Error(`No storage location ID found. Please create a storage location first.`);
    }

    const quota = (
        await filezClient.api.createStorageQuota({
            storage_quota_bytes: 10_000_000_000, // 10 GB
            storage_quota_subject_type: StorageQuotaSubjectType.User,
            storage_quota_subject_id: ownUser.id,
            storage_location_id,
            storage_quota_name: `Admin's Storage Quota`
        })
    ).data?.data?.created_storage_quota;

    log.info(`Created storage quota for Admin: ${quota?.id}`);
};

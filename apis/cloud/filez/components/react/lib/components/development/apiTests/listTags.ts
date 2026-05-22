import { Api, TagResourceType } from "filez-client-typescript";
import { log } from "@mows/react-components/lib/logging";

export default async (filezClient: Api<unknown>) => {
    const tags = (await filezClient.api.listTags({ resource_type: TagResourceType.File })).data
        ?.data?.tags;

    if (!tags) {
        throw new Error(`Failed to list tags.`);
    }

    log.info(`Retrieved ${tags.length} tags.`);
};

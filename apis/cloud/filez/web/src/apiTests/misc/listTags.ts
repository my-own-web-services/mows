import { Api, TagResourceType } from "filez-client-typescript";

export default async (filezClient: Api<unknown>) => {
    const tags = (await filezClient.api.listTags({ resource_type: TagResourceType.File })).data
        ?.data?.tags;

    if (!tags) {
        throw new Error("Failed to list tags.");
    }

    console.log(`Retrieved ${tags.length} tags.`);
};

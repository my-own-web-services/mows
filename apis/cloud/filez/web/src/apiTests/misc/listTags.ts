import { Api } from "filez-client-typescript";

export default async (filezClient: Api<unknown>) => {
    const tags = (await filezClient.api.listTags({})).data?.data?.tags;

    if (!tags) {
        throw new Error("Failed to list tags.");
    }

    console.log(`Retrieved ${tags.length} tags.`);
};

import { FilezClient } from "filez-client-typescript";

export default async (filezClient: FilezClient) => {
    await filezClient.api.resetDatabase({});
};

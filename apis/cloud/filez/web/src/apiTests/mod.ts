import { Api } from "../api-client";
import { tagsTest } from "./misc/20-tags";

export const runTests = async (filezClient: Api<unknown>) => {
    console.log("Running API tests...");

    //await allroundTest(filezClient);

    await tagsTest(filezClient);

    console.log("API tests completed.");
};

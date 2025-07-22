import { Api } from "../api-client";
import { allroundTest10 } from "./misc/10-allround";

export const runTests = async (filezClient: Api<unknown>) => {
    console.log("Running API tests...");

    await allroundTest10(filezClient);

    console.log("API tests completed.");
};

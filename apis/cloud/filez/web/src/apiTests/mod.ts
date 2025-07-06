import { Api } from "../api-client";

export const runTests = async (filezClient: Api<unknown>) => {
    console.log("Running API tests...");

    testUsers(filezClient);

    console.log("API tests completed.");
};

const testUsers = async (filezClient: Api<unknown>) => {
    console.log("Testing users...");
};

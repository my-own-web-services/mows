import { Api } from "../api-client";
import { testUsers } from "./Users";

export const runTests = async (filezClient: Api<unknown>) => {
    console.log("Running API tests...");

    await testUsers(filezClient);

    console.log("API tests completed.");
};

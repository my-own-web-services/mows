import { Api } from "../api-client";
import { testUsers } from "./Users";

export const runTests = async (filezClient: Api<unknown>) => {
    console.log("Running API tests...");

    await testUsers(filezClient);

    console.log("API tests completed.");
};

const allroundTest = async (filezClient: Api<unknown>) => {
    console.log("Running all-round test...");
    // Create 2 users: Alice and Bob
    //const alice = await filezClient.api.createUser({});
};

// create 2 users alice and bob
// create a storage quota for that alice

// impersonate alice
// create a new file
// create a file version
// upload content for this version
// get the content for this version
// update the content

// create 10 files
// create multiple versions for all 10 files
// update the metadata for the 10 files

// create 2 file groups
// add the 10 files to the file groups random 7 into the first 3 in the second
// list the files of the file groups
// create a access rule that allows the listing of files in the file group to bob

// impersonate bob
// try to list the files in the file group
// try to delete the files in the file group

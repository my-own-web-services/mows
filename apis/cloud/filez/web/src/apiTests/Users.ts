import { Api, ApiResponseStatus } from "../api-client";

export const testUsers = async (filezClient: Api<unknown>) => {
    console.log("Testing Users...");
    console.log("Trying to apply own user...");
    const applyUserResponse = await filezClient.api.applyUser();
    if (
        applyUserResponse.status === 200 &&
        applyUserResponse.data.status === ApiResponseStatus.Success
    ) {
        console.log("Apply user successful:", applyUserResponse.data);
    } else {
        console.error("Apply user failed:", applyUserResponse);
        throw new Error("Apply user failed");
    }

    console.log("Testing Users completed.");
};

import { Api } from "filez-client-typescript";

export default async (filezClient: Api<unknown>) => {
    const fileShouldWork = await filezClient.api.createFile({
        // 256 bytes of data
        file_name: "a".repeat(256),
        mime_type: "text/plain"
    });

    if (!fileShouldWork.data?.data?.created_file) {
        throw new Error("Failed to create file.");
    }
    console.log(`Created file: ${fileShouldWork.data?.data?.created_file.id}`);

    const fileShouldFail = await filezClient.api
        .createFile({
            // 257 bytes of data
            file_name: "a".repeat(257),
            mime_type: "text/plain"
        })
        .catch((response) => {
            // Expected to fail
            if (response.status !== 400) {
                throw new Error(`Expected 400 status code, got ${response.status}`);
            }
            return response;
        });
    if (fileShouldFail.data?.data?.created_file) {
        throw new Error("File creation should have failed due to validation.");
    }
    console.log("File creation failed as expected due to validation.");
};

import { exec as execOld } from "node:child_process";
import util from "node:util";
import { testCreateFile } from "./tests/createFile.js";
import { createFileAboveUserLimits } from "./tests/createFileAboveUserLimits.js";
import { createFileWithFileGroupOwnedByUser } from "./tests/createFileWithFileGroupOwnedByUser.js";
import { createFileWithNonExistingFileGroup } from "./tests/createFileWithNonExistingFileGroup.js";
import { createFileWithNotUserOwnedFileGroup } from "./tests/createFileWithNotUserOwnedFileGroup.js";
const exec = util.promisify(execOld);

// start database
const { stdout, stderr } = await exec(
    "docker-compose -f ../dev/docker-compose.yml up -d --remove-orphans"
);

try {
    console.log("1. Creating, getting and deleting a file");
    await testCreateFile();
    console.log("✅");
} catch (error) {
    console.log("❌");
    throw error;
}

try {
    console.log("2. Fail to create a file that exceeds user limits");
    await createFileAboveUserLimits();
    console.log("✅");
} catch (error) {
    console.log("❌");
    throw error;
}

try {
    console.log("3. Fail to create a file because the file group does not exist");
    await createFileWithNonExistingFileGroup();
    console.log("✅");
} catch (error) {
    console.log("❌");
    throw error;
}

try {
    console.log("4. Fail to create a file because the file group is not owned by the user");
    await createFileWithNotUserOwnedFileGroup();
    console.log("✅");
} catch (error) {
    console.log("❌");
    throw error;
}

try {
    console.log("5. Succeed in creating a file with a file group owned by the user");
    await createFileWithFileGroupOwnedByUser();
    console.log("✅");
} catch (error) {
    console.log("❌");
    throw error;
}

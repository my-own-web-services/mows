import { promises as fs } from "node:fs";
import { Database, aql } from "arangojs";

export const createFileAboveUserLimits = async () => {
    // prepare database
    await setupDb();

    // Create a new file
    const createdFile = await createFile();

    if (createdFile !== "Internal Server Error: User storage limit exceeded") {
        throw new Error("File should not have been created");
    }
};

export const setupDb = async () => {
    // setup database
    const db1 = new Database({
        url: "http://localhost:8529",
        auth: {
            username: "root",
            password: "password"
        }
    });

    await db1.dropDatabase("filez").catch(e => {});

    // create database
    const db = await db1.createDatabase("filez").catch(e => {
        return db1.database("filez");
    });

    // create collections
    await db.createCollection("files").catch(e => {
        //console.error(e);
    });
    await db.createCollection("users").catch(e => {
        //console.error(e);
    });
    await db.createCollection("permissions").catch(e => {
        //console.error(e);
    });
    await db.createCollection("userGroups").catch(e => {
        //console.error(e);
    });
    await db.createCollection("fileGroups").catch(e => {
        //console.error(e);
    });

    // create default user for tests
    await db
        .query(
            aql`
        INSERT {
            "_key": "dev",
            "limits": {
                "ssd": {
                    "maxStorage": 20,
                    "usedStorage": 0,
                    "maxFiles": 1000,
                    "usedFiles": 0,
                    "maxBandwidth": 0,
                    "usedBandwidth": 0
                }
            },
            "appData":{},
            "groupIds":[]
        } INTO users`
        )
        .catch(e => {
            console.error(e);
        });
};

interface CreatedFileResponse {
    fileId: string;
    storageName: string;
    sha256: string;
}

const createFile = async () => {
    const file = await fs.readFile("test-files/21bytes.txt");

    const request = JSON.stringify({ name: "21bytes.txt", mimeType: "text/plain" });

    const res = await fetch("http://localhost:8080/api/create_file/", {
        headers: {
            request
        },
        method: "POST",
        body: file
    });
    return await res.text();
};

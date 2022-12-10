import { promises as fs } from "node:fs";
import { Database, aql } from "arangojs";

export const testCreateFile = async () => {
    // prepare database
    await setupDb();

    // Create a new file
    const createdFile = await createFile();

    // get file
    await getFile(createdFile.fileId);

    // delete file
    await deleteFile(createdFile.fileId);

    // check if the user account has its file limits reset
    await checkUserLimits();
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
                    "maxStorage": 1000000,
                    "usedStorage": 0,
                    "maxFiles": 1000,
                    "usedFiles": 0,
                    "maxBandwidth": 0,
                    "usedBandwidth": 0
                }
            },
            "appData":{},
            "userGroupIds":[]
        } INTO users`
        )
        .catch(e => {
            console.error(e);
        });
};

const checkUserLimits = async () => {
    const db = new Database({
        url: "http://localhost:8529",
        auth: {
            username: "root",
            password: "password"
        }
    }).database("filez");

    const res = await db.query(aql`

        FOR user IN users
            FILTER user._key == "dev"
            RETURN user.limits.ssd
    `);
    const a = await res.next();
    if (a.maxFiles !== 1000 || a.maxStorage !== 1000000) {
        throw new Error("User limits not reset");
    }
};

const deleteFile = async (id: string) => {
    const res = await fetch(`http://localhost:8080/api/delete_file/${id}`, { method: "POST" });
    if (res.status !== 200) {
        throw new Error("Could not delete file");
    }
    return true;
};

const getFile = async (id: string) => {
    const res = await fetch(`http://localhost:8080/api/get_file/${id}`);
    const ct = res.headers.get("content-type");
    const file = await res.text();
    if (ct !== "text/plain") {
        throw new Error(`Wrong content type: ${ct}; file content: ${file}`);
    }

    if (file !== "abc") {
        throw new Error("Wrong content");
    }
    return file;
};

interface CreatedFileResponse {
    fileId: string;
    storageName: string;
    sha256: string;
}

const createFile = async (): Promise<CreatedFileResponse> => {
    const file = await fs.readFile("test-files/test.txt");

    const request = JSON.stringify({ name: "test.txt", mimeType: "text/plain" });

    const res = await fetch("http://localhost:8080/api/create_file/", {
        headers: {
            request
        },
        method: "POST",
        body: file
    });
    let text = await res.text();
    try {
        let json = JSON.parse(text);
        return json as CreatedFileResponse;
    } catch (error) {
        throw new Error(`Could not parse response: ${text}`);
    }
};

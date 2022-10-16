import { exec as execOld, spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import util from "node:util";
const exec = util.promisify(execOld);
import { Database, aql } from "arangojs";

export const testCreateFile = async () => {
    // start database
    const { stdout, stderr } = await exec(
        "docker-compose -f ../dev/docker-compose.yml up -d --remove-orphans"
    );
    // prepare database
    await setupDb();
    // Create a new file
    const createdFile = await createFile();

    // get file
    await getFile(createdFile.id);

    // delete file
    await deleteFile(createdFile.id);

    // stop database

    // stop server
};

export const deleteFile = async (id: string) => {
    const res = await fetch(`http://0.0.0.0:8080/delete_file/${id}`, { method: "POST" });
    if (res.status !== 200) {
        throw new Error("Could not delete file");
    }
    return true;
};

export const getFile = async (id: string) => {
    const res = await fetch(`http://0.0.0.0:8080/get_file/${id}`);
    if (res.headers.get("content-type") !== "text/plain") {
        throw new Error("Wrong content type");
    }
    const file = await res.text();
    if (file !== "abc") {
        throw new Error("Wrong content");
    }
    return file;
};

export interface CreatedFileResponse {
    id: string;
    storageName: string;
    sha256: string;
}

export const createFile = async (): Promise<CreatedFileResponse> => {
    const file = await fs.readFile("test-files/test.txt");
    const res = await fetch("http://0.0.0.0:8080/create_file", {
        headers: {
            request: JSON.stringify({ name: "test.txt", mimeType: "text/plain" })
        },
        method: "POST",
        body: file
    });
    const json = await res.json();
    return json as CreatedFileResponse;
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

    // create default user for tests
    await db
        .query(
            aql`
        INSERT {
            "_key": "test",
            "limits": {
                "ssd": {
                    "maxStorage": 1000000,
                    "usedStorage": 0,
                    "maxFiles": 1000,
                    "usedFiles": 0,
                    "maxBandwidth": 0,
                    "usedBandwidth": 0
                }
            }
        } INTO users`
        )
        .catch(e => {
            console.error(e);
        });
};

await testCreateFile();

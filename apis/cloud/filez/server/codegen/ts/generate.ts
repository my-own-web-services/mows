import * as path from "node:path";
import * as process from "node:process";
import { generateApi } from "swagger-typescript-api";

await generateApi({ input: "/app/openapi.json",output:"/app/out",fileName:"api-client.ts", });

// replace 
// [ContentType.UrlEncoded]: (input: any) => this.toQueryString(input)
// with
// [ContentType.UrlEncoded]: (input: any) => this.toQueryString(input),
// [ContentType.Binary]: (input: any) => input
// and 
// Text = "text/plain",
// with 
// Text = "text/plain",
// Binary = "application/octet-stream"

import * as fs from "node:fs/promises";
const filePath = path.join(process.cwd(), "out", "api-client.ts");
let content = await fs  
    .readFile(filePath, "utf-8")
    .then((data) => data.replace(
        `[ContentType.UrlEncoded]: (input: any) => this.toQueryString(input)`,
        `[ContentType.UrlEncoded]: (input: any) => this.toQueryString(input),
    [ContentType.Binary]: (input: any) => input`
    ))
    .then((data) => data.replace(
        `Text = "text/plain"`,
        `Text = "text/plain",
  Binary = "application/octet-stream"`
    ));
await fs.writeFile(filePath, content, "utf-8");
import { generateApi } from "swagger-typescript-api";

await generateApi({
    input: "/app/openapi.json",
    output: "/app/out",
    fileName: "api-client.ts"
});

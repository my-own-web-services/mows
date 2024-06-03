import request from "supertest";
import { settings } from "./settings";

describe("Basics", () => {
    test("Server is online", async() => {
        const response = await request(settings.filezServerAddress).get("/");
        expect(response.status).toBe(404);
    });
});
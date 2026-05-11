import { expect, test, type Route } from "@playwright/test";

const stubBackend = async (page: import("@playwright/test").Page) => {
    // Suppress every backend WebSocket attempt — Playwright can't fulfill ws:// routes
    // but we never want them to actually connect during e2e.
    await page.addInitScript(() => {
        const originalWebSocket = window.WebSocket;
        // @ts-expect-error mock partial WebSocket surface
        window.WebSocket = function MockWebSocket(url: string) {
            const listeners: Record<string, Array<(ev: unknown) => void>> = {};
            return {
                url,
                readyState: originalWebSocket.CLOSED,
                close() {},
                send() {},
                addEventListener(type: string, cb: (ev: unknown) => void) {
                    (listeners[type] ||= []).push(cb);
                },
                removeEventListener() {},
                set onopen(_: unknown) {},
                set onclose(_: unknown) {},
                set onmessage(_: unknown) {},
                set onerror(_: unknown) {}
            };
        } as unknown as typeof WebSocket;
    });

    await page.route(`http://localhost:3000/api/**`, async (route: Route) => {
        // Default success response for any API call we don't explicitly intercept.
        await route.fulfill({
            status: 200,
            contentType: `application/json`,
            body: JSON.stringify({ status: `Success`, message: `ok`, data: null })
        });
    });
};

test.describe(`Dev page`, () => {
    test.beforeEach(async ({ page }) => {
        await stubBackend(page);
    });

    test(`renders the home page`, async ({ page }) => {
        await page.goto(`/`);
        await expect(page.getByRole(`heading`, { name: `Welcome to the MOWS Manager` })).toBeVisible();
    });

    test(`renders the devtools page with all main sections`, async ({ page }) => {
        await page.goto(`/devtools/`);
        await expect(page.getByRole(`heading`, { name: `Manager`, level: 1 })).toBeVisible();
        await expect(page.getByRole(`heading`, { name: `Clusters`, level: 1 })).toBeVisible();
        await expect(page.getByRole(`heading`, { name: `Machines`, level: 1 })).toBeVisible();
    });

    test(`POSTs the correct payload when creating 3 local VMs`, async ({ page }) => {
        let capturedRequest: { url: string; method: string; body: unknown } | undefined;

        await page.route(`http://localhost:3000/api/machines/create`, async (route: Route) => {
            const request = route.request();
            capturedRequest = {
                url: request.url(),
                method: request.method(),
                body: request.postDataJSON()
            };
            await route.fulfill({
                status: 200,
                contentType: `application/json`,
                body: JSON.stringify({
                    status: `Success`,
                    message: `Created 3 machines`,
                    data: null
                })
            });
        });

        await page.goto(`/devtools/`);
        await page.getByRole(`button`, { name: `Create 3 local VMs` }).click();

        await expect.poll(() => capturedRequest).toBeDefined();
        expect(capturedRequest?.method).toBe(`POST`);
        expect(capturedRequest?.url).toBe(`http://localhost:3000/api/machines/create`);
        expect(capturedRequest?.body).toEqual({
            machines: [
                { LocalQemu: { memory: 16, cpus: 4 } },
                { LocalQemu: { memory: 16, cpus: 4 } },
                { LocalQemu: { memory: 16, cpus: 4 } }
            ]
        });

        // The success toast from sonner should appear (description text)
        await expect(
            page.locator(`[data-sonner-toast]`).filter({ hasText: `Created 3 machines` })
        ).toBeVisible({ timeout: 8000 });
    });

    test(`POSTs the hcloud payload when creating an hcloud machine`, async ({ page }) => {
        let capturedBody: unknown;

        await page.route(`http://localhost:3000/api/machines/create`, async (route: Route) => {
            capturedBody = route.request().postDataJSON();
            await route.fulfill({
                status: 200,
                contentType: `application/json`,
                body: JSON.stringify({ status: `Success`, message: `Created`, data: null })
            });
        });

        await page.goto(`/devtools/`);
        await page.getByRole(`button`, { name: `Create hcloud machine` }).click();

        await expect.poll(() => capturedBody).toBeDefined();
        expect(capturedBody).toEqual({
            machines: [
                { ExternalHcloud: { server_type: `cx22`, location: `nbg1` } }
            ]
        });
    });

    test(`shows an error toast when the backend rejects machine creation`, async ({ page }) => {
        await page.route(`http://localhost:3000/api/machines/create`, async (route: Route) => {
            await route.fulfill({
                status: 200,
                contentType: `application/json`,
                body: JSON.stringify({
                    status: `Error`,
                    message: `Backend refused to spawn`,
                    data: null
                })
            });
        });

        await page.goto(`/devtools/`);
        await page.getByRole(`button`, { name: `Create 3 local VMs` }).click();

        await expect(
            page.locator(`[data-sonner-toast]`).filter({ hasText: `Backend refused to spawn` })
        ).toBeVisible({ timeout: 8000 });
    });

    test(`DELETEs when "Delete all MOWS local VMs" is clicked`, async ({ page }) => {
        let captured: { method?: string; url?: string } = {};

        await page.route(
            `http://localhost:3000/api/machines/dev_delete_all`,
            async (route: Route) => {
                captured = {
                    method: route.request().method(),
                    url: route.request().url()
                };
                await route.fulfill({
                    status: 200,
                    contentType: `application/json`,
                    body: JSON.stringify({ status: `Success`, message: `deleted`, data: null })
                });
            }
        );

        await page.goto(`/devtools/`);
        await page.getByRole(`button`, { name: `Delete all MOWS local VMs` }).click();

        await expect.poll(() => captured.method).toBe(`DELETE`);
        expect(captured.url).toBe(`http://localhost:3000/api/machines/dev_delete_all`);
    });
});

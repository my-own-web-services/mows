import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, vi } from "vitest";

// runs a clean after each test case (e.g. clearing jsdom)
afterEach(() => {
    cleanup();
});

// Mock fetch for client-config.json requests and matchMedia
beforeAll(() => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === `/client-config.json`) {
            return Promise.resolve({
                ok: true,
                json: () =>
                    Promise.resolve({
                        oidcClientId: `331760958303175012`,
                        oidcIssuerUrl: `https://zitadel.vindelicorum.eu`,
                        serverUrl: `https://filez-server.vindelicorum.eu`
                    })
            });
        }
        return Promise.reject(new Error(`Unhandled fetch request: ${url}`));
    });

    // Mock matchMedia
    Object.defineProperty(window, `matchMedia`, {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(), // deprecated
            removeListener: vi.fn(), // deprecated
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn()
        }))
    });

    // Mock ResizeObserver for Command component
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn()
    }));

    // Mock scrollIntoView for Command component
    Element.prototype.scrollIntoView = vi.fn();
});

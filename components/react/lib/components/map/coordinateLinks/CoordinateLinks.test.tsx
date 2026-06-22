import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import CoordinateLinks from "./CoordinateLinks";
import {
    BUILTIN_MAP_PROVIDERS,
    DEFAULT_PROVIDER_ORDER,
    resolveProviders
} from "./providers";

afterEach(() => {
    cleanup();
});

const LONDON = { latitude: 51.5074, longitude: -0.1278 };

describe(`CoordinateLinks`, () => {
    it(`renders one link per default provider when no list is given`, () => {
        render(<CoordinateLinks {...LONDON} />);
        const links = screen.getAllByRole(`link`);
        expect(links).toHaveLength(DEFAULT_PROVIDER_ORDER.length);
    });

    it(`uses the coordinate as the link text for the geo: provider`, () => {
        render(<CoordinateLinks {...LONDON} providers={[`geo`]} />);
        const link = screen.getByRole(`link`);
        expect(link.textContent).toBe(`51.50740, -0.12780`);
    });

    it(`renders static provider labels verbatim for non-geo built-ins`, () => {
        render(<CoordinateLinks {...LONDON} providers={[`openstreetmap`, `google`]} />);
        expect(screen.getByText(BUILTIN_MAP_PROVIDERS.openstreetmap.label as string)).toBeInTheDocument();
        expect(screen.getByText(BUILTIN_MAP_PROVIDERS.google.label as string)).toBeInTheDocument();
    });

    it(`opens every link in a new tab with noopener referrer hygiene`, () => {
        render(<CoordinateLinks {...LONDON} />);
        for (const link of screen.getAllByRole(`link`)) {
            expect(link).toHaveAttribute(`target`, `_blank`);
            expect(link.getAttribute(`rel`)).toContain(`noopener`);
            expect(link.getAttribute(`rel`)).toContain(`noreferrer`);
        }
    });

    it(`builds the geo: URI with the bare scheme and optional zoom query`, () => {
        render(<CoordinateLinks {...LONDON} providers={[`geo`]} zoom={9} />);
        expect(screen.getByRole(`link`).getAttribute(`href`)).toBe(
            `geo:51.5074,-0.1278?z=9`
        );
    });

    it(`drops the zoom query from the geo: URI when no zoom is given`, () => {
        render(<CoordinateLinks {...LONDON} providers={[`geo`]} />);
        expect(screen.getByRole(`link`).getAttribute(`href`)).toBe(
            `geo:51.5074,-0.1278`
        );
    });

    it(`builds the Google Maps href with lat,lng query syntax`, () => {
        render(<CoordinateLinks {...LONDON} providers={[`google`]} />);
        expect(screen.getByRole(`link`).getAttribute(`href`)).toBe(
            `https://www.google.com/maps?q=51.5074,-0.1278`
        );
    });

    it(`renders provider order from the prop verbatim`, () => {
        render(
            <CoordinateLinks
                {...LONDON}
                providers={[`apple`, `openstreetmap`, `bing`]}
            />
        );
        const labels = screen
            .getAllByRole(`link`)
            .map((a) => a.textContent ?? ``);
        expect(labels).toEqual([`Apple Maps`, `OpenStreetMap`, `Bing Maps`]);
    });

    it(`accepts a custom provider record alongside built-in ids`, () => {
        render(
            <CoordinateLinks
                {...LONDON}
                providers={[
                    `google`,
                    {
                        id: `acme`,
                        label: `ACME Geo`,
                        buildUrl: (lat, lng) => `https://acme.example/?p=${lat}:${lng}`
                    }
                ]}
            />
        );
        const acme = screen.getByRole(`link`, { name: /ACME Geo/ });
        expect(acme).toHaveAttribute(`data-provider`, `acme`);
        expect(acme).toHaveAttribute(
            `href`,
            `https://acme.example/?p=51.5074:-0.1278`
        );
    });

    it(`announces the resolved coordinate in each link's aria-label`, () => {
        render(<CoordinateLinks {...LONDON} providers={[`google`]} />);
        const link = screen.getByRole(`link`);
        expect(link.getAttribute(`aria-label`)).toMatch(/Google Maps/);
        expect(link.getAttribute(`aria-label`)).toContain(`51.50740, -0.12780`);
    });

    it(`announces the default-app role in the geo: link's aria-label`, () => {
        render(<CoordinateLinks {...LONDON} providers={[`geo`]} />);
        const link = screen.getByRole(`link`);
        expect(link.getAttribute(`aria-label`)).toMatch(/default map app/);
    });

    it(`renders the optional label heading when provided`, () => {
        render(<CoordinateLinks {...LONDON} label={`Open in`} />);
        expect(screen.getByTestId(`coordinate-links-label`).textContent).toBe(
            `Open in`
        );
    });

    it(`omits the heading element when no label is supplied`, () => {
        render(<CoordinateLinks {...LONDON} />);
        expect(screen.queryByTestId(`coordinate-links-label`)).toBeNull();
    });

    it(`throws synchronously for an out-of-range latitude`, () => {
        const original = console.error;
        console.error = () => {};
        try {
            expect(() =>
                render(<CoordinateLinks latitude={91} longitude={0} />)
            ).toThrow(/latitude must be in/);
        } finally {
            console.error = original;
        }
    });

    it(`throws synchronously for an out-of-range longitude`, () => {
        const original = console.error;
        console.error = () => {};
        try {
            expect(() =>
                render(<CoordinateLinks latitude={0} longitude={181} />)
            ).toThrow(/longitude must be in/);
        } finally {
            console.error = original;
        }
    });

    it(`throws synchronously when given a non-finite number`, () => {
        const original = console.error;
        console.error = () => {};
        try {
            expect(() =>
                render(<CoordinateLinks latitude={Number.NaN} longitude={0} />)
            ).toThrow(/finite numbers/);
        } finally {
            console.error = original;
        }
    });
});

describe(`resolveProviders`, () => {
    it(`returns the default order when called with no input`, () => {
        const resolved = resolveProviders();
        expect(resolved.map((p) => p.id)).toEqual(DEFAULT_PROVIDER_ORDER);
    });

    it(`throws for an unknown built-in id (no silent empty render)`, () => {
        // @ts-expect-error — intentionally invalid id to exercise the guard.
        expect(() => resolveProviders([`not-a-real-provider`])).toThrow(
            /unknown built-in provider id/
        );
    });
});

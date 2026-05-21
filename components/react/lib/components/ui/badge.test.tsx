import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./badge";

describe(`Badge`, () => {
    it(`renders its children`, () => {
        render(<Badge>hello</Badge>);
        expect(screen.getByText(`hello`)).toBeInTheDocument();
    });

    it(`applies the default variant when none is provided`, () => {
        render(<Badge>default</Badge>);
        const el = screen.getByText(`default`);
        expect(el.className).toMatch(/bg-primary/);
        expect(el.className).toMatch(/text-primary-foreground/);
    });

    it.each([
        [`secondary`, /bg-secondary/, /text-secondary-foreground/],
        [`destructive`, /bg-destructive/, /text-destructive-foreground/],
        [`outline`, /text-foreground/, /text-foreground/],
        [`success`, /bg-emerald-500\/20/, /text-emerald-500/],
        [`warning`, /bg-amber-500\/20/, /text-amber-500/],
        [`info`, /bg-sky-500\/20/, /text-sky-500/],
        [`muted`, /bg-muted/, /text-muted-foreground/]
    ] as const)(`applies %s variant classes`, (variant, bg, fg) => {
        render(<Badge variant={variant}>{variant}</Badge>);
        const el = screen.getByText(variant);
        expect(el.className).toMatch(bg);
        expect(el.className).toMatch(fg);
    });

    it(`forwards an extra className without dropping the variant classes`, () => {
        render(<Badge className={`custom-cls`}>custom</Badge>);
        const el = screen.getByText(`custom`);
        expect(el.className).toMatch(/custom-cls/);
        expect(el.className).toMatch(/bg-primary/);
    });

    it(`forwards arbitrary HTML attributes (e.g. data-*)`, () => {
        render(<Badge data-testid={`badge-attr`}>attr</Badge>);
        expect(screen.getByTestId(`badge-attr`)).toBeInTheDocument();
    });
});

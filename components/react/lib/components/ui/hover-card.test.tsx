import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger
} from "./hover-card";

const renderCard = (opts: { defaultOpen?: boolean; openDelay?: number } = {}) =>
    render(
        <HoverCard defaultOpen={opts.defaultOpen} openDelay={opts.openDelay ?? 0}>
            <HoverCardTrigger>hover me</HoverCardTrigger>
            <HoverCardContent>hover body</HoverCardContent>
        </HoverCard>
    );

describe(`HoverCard`, () => {
    it(`is closed by default — content is not rendered`, () => {
        renderCard();
        expect(screen.queryByText(`hover body`)).not.toBeInTheDocument();
    });

    it(`renders the content when defaultOpen is set`, () => {
        renderCard({ defaultOpen: true });
        expect(screen.getByText(`hover body`)).toBeInTheDocument();
    });

    // HoverCard's hover/focus open is driven by pointer events + an
    // openDelay timer. Both depend on the pointer-event + timer behaviour
    // that jsdom does not fully replicate. The hover round-trip is
    // exercised in the matching doc-page example, not here. The controlled
    // `defaultOpen` path covers the public open/closed contract.

    it(`applies width and popover background to the content`, () => {
        renderCard({ defaultOpen: true });
        const body = screen.getByText(`hover body`);
        expect(body.className).toMatch(/w-64/);
        expect(body.className).toMatch(/bg-popover/);
    });
});

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from "./card";

describe(`Card`, () => {
    it(`renders the card shell with rounded border + card background`, () => {
        const { container } = render(<Card>body</Card>);
        const card = container.firstChild as HTMLElement;
        expect(card.className).toMatch(/rounded-lg/);
        expect(card.className).toMatch(/border/);
        expect(card.className).toMatch(/bg-card/);
        expect(card).toHaveTextContent(`body`);
    });

    it(`renders header / title / description / content / footer in order`, () => {
        const { container } = render(
            <Card>
                <CardHeader>
                    <CardTitle>title</CardTitle>
                    <CardDescription>desc</CardDescription>
                </CardHeader>
                <CardContent>content</CardContent>
                <CardFooter>footer</CardFooter>
            </Card>
        );
        const card = container.firstChild as HTMLElement;
        const order = Array.from(card.children).map((c) => c.textContent);
        expect(order).toEqual([`titledesc`, `content`, `footer`]);
    });

    it(`title carries the heading typography classes`, () => {
        render(<CardTitle data-testid={`t`}>t</CardTitle>);
        const el = screen.getByTestId(`t`);
        expect(el.className).toMatch(/font-semibold/);
        expect(el.className).toMatch(/text-2xl/);
    });

    it(`description uses muted-foreground colour`, () => {
        render(<CardDescription data-testid={`d`}>d</CardDescription>);
        const el = screen.getByTestId(`d`);
        expect(el.className).toMatch(/text-muted-foreground/);
    });

    it(`each subcomponent forwards a ref to its rendered div`, () => {
        const cardRef = { current: null as HTMLDivElement | null };
        const titleRef = { current: null as HTMLDivElement | null };
        render(
            <Card ref={cardRef}>
                <CardTitle ref={titleRef}>x</CardTitle>
            </Card>
        );
        expect(cardRef.current).toBeInstanceOf(HTMLDivElement);
        expect(titleRef.current).toBeInstanceOf(HTMLDivElement);
    });

    it(`each subcomponent merges a forwarded className with its base classes`, () => {
        render(
            <Card className={`my-card`}>
                <CardHeader className={`my-header`}>
                    <CardTitle className={`my-title`}>x</CardTitle>
                </CardHeader>
            </Card>
        );
        const title = screen.getByText(`x`);
        expect(title.className).toMatch(/my-title/);
        expect(title.className).toMatch(/font-semibold/);
    });
});

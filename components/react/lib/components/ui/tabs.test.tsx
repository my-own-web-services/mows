import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const renderTabs = (defaultValue = `one`) =>
    render(
        <Tabs defaultValue={defaultValue}>
            <TabsList>
                <TabsTrigger value={`one`}>One</TabsTrigger>
                <TabsTrigger value={`two`}>Two</TabsTrigger>
                <TabsTrigger value={`three`} disabled>
                    Three
                </TabsTrigger>
            </TabsList>
            <TabsContent value={`one`}>Panel one</TabsContent>
            <TabsContent value={`two`}>Panel two</TabsContent>
            <TabsContent value={`three`}>Panel three</TabsContent>
        </Tabs>
    );

describe(`Tabs`, () => {
    it(`shows the default tab content`, () => {
        renderTabs();
        expect(screen.getByText(`Panel one`)).toBeInTheDocument();
        expect(screen.queryByText(`Panel two`)).not.toBeInTheDocument();
    });

    it(`switches content when a trigger is clicked`, async () => {
        const user = userEvent.setup();
        renderTabs();
        await user.click(screen.getByRole(`tab`, { name: `Two` }));
        expect(screen.getByText(`Panel two`)).toBeInTheDocument();
        expect(screen.queryByText(`Panel one`)).not.toBeInTheDocument();
    });

    it(`marks the active trigger via data-state`, async () => {
        const user = userEvent.setup();
        renderTabs();
        const triggerOne = screen.getByRole(`tab`, { name: `One` });
        const triggerTwo = screen.getByRole(`tab`, { name: `Two` });
        expect(triggerOne).toHaveAttribute(`data-state`, `active`);
        expect(triggerTwo).toHaveAttribute(`data-state`, `inactive`);

        await user.click(triggerTwo);

        expect(triggerOne).toHaveAttribute(`data-state`, `inactive`);
        expect(triggerTwo).toHaveAttribute(`data-state`, `active`);
    });

    it(`does not activate a disabled trigger`, async () => {
        const user = userEvent.setup();
        renderTabs();
        const disabled = screen.getByRole(`tab`, { name: `Three` });
        expect(disabled).toBeDisabled();
        await user.click(disabled);
        expect(screen.queryByText(`Panel three`)).not.toBeInTheDocument();
    });

    it(`honours a controlled value`, () => {
        const { rerender } = render(
            <Tabs value={`one`} onValueChange={() => undefined}>
                <TabsList>
                    <TabsTrigger value={`one`}>One</TabsTrigger>
                    <TabsTrigger value={`two`}>Two</TabsTrigger>
                </TabsList>
                <TabsContent value={`one`}>Panel one</TabsContent>
                <TabsContent value={`two`}>Panel two</TabsContent>
            </Tabs>
        );
        expect(screen.getByText(`Panel one`)).toBeInTheDocument();

        rerender(
            <Tabs value={`two`} onValueChange={() => undefined}>
                <TabsList>
                    <TabsTrigger value={`one`}>One</TabsTrigger>
                    <TabsTrigger value={`two`}>Two</TabsTrigger>
                </TabsList>
                <TabsContent value={`one`}>Panel one</TabsContent>
                <TabsContent value={`two`}>Panel two</TabsContent>
            </Tabs>
        );

        expect(screen.getByText(`Panel two`)).toBeInTheDocument();
    });
});

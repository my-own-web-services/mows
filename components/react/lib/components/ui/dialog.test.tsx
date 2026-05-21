import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "./dialog";

const renderDialog = (opts: { defaultOpen?: boolean } = {}) =>
    render(
        <Dialog defaultOpen={opts.defaultOpen}>
            <DialogTrigger>open</DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>my title</DialogTitle>
                    <DialogDescription>my description</DialogDescription>
                </DialogHeader>
                <p>body content</p>
                <DialogFooter>footer</DialogFooter>
            </DialogContent>
        </Dialog>
    );

describe(`Dialog`, () => {
    it(`is closed by default — content is not rendered`, () => {
        renderDialog();
        expect(screen.queryByText(`my title`)).not.toBeInTheDocument();
    });

    it(`renders the content when defaultOpen is set`, () => {
        renderDialog({ defaultOpen: true });
        expect(screen.getByText(`my title`)).toBeInTheDocument();
        expect(screen.getByText(`my description`)).toBeInTheDocument();
        expect(screen.getByText(`body content`)).toBeInTheDocument();
        expect(screen.getByText(`footer`)).toBeInTheDocument();
    });

    it(`opens when the trigger is clicked`, async () => {
        const user = userEvent.setup();
        renderDialog();
        await user.click(screen.getByText(`open`));
        expect(screen.getByText(`my title`)).toBeInTheDocument();
    });

    it(`exposes role="dialog" with the title + description wired into aria`, () => {
        renderDialog({ defaultOpen: true });
        const dialog = screen.getByRole(`dialog`);
        expect(dialog).toHaveAttribute(`aria-labelledby`);
        expect(dialog).toHaveAttribute(`aria-describedby`);
        const labelId = dialog.getAttribute(`aria-labelledby`);
        const descId = dialog.getAttribute(`aria-describedby`);
        expect(document.getElementById(labelId!)).toHaveTextContent(`my title`);
        expect(document.getElementById(descId!)).toHaveTextContent(`my description`);
    });

    it(`renders a built-in close button labelled "Close"`, async () => {
        const user = userEvent.setup();
        renderDialog({ defaultOpen: true });
        const closeBtn = screen.getByRole(`button`, { name: `Close` });
        await user.click(closeBtn);
        expect(screen.queryByRole(`dialog`)).not.toBeInTheDocument();
    });

    it(`closes on Escape`, async () => {
        const user = userEvent.setup();
        renderDialog({ defaultOpen: true });
        await user.keyboard(`{Escape}`);
        expect(screen.queryByRole(`dialog`)).not.toBeInTheDocument();
    });
});

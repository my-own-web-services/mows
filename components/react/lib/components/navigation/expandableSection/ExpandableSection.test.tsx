import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ExpandableSection from "./ExpandableSection";

afterEach(() => {
    cleanup();
});

describe(`ExpandableSection`, () => {
    it(`is collapsed by default — body is not rendered`, () => {
        render(
            <ExpandableSection
                header={`Header`}
                testId={`s`}
            >
                <p>body</p>
            </ExpandableSection>
        );
        expect(screen.getByText(`Header`)).toBeInTheDocument();
        expect(screen.queryByText(`body`)).toBeNull();
    });

    it(`renders the body when opened via click`, async () => {
        const user = userEvent.setup();
        render(
            <ExpandableSection header={`Header`} testId={`s`}>
                <p>body</p>
            </ExpandableSection>
        );
        await user.click(screen.getByTestId(`s-trigger`));
        expect(screen.getByText(`body`)).toBeInTheDocument();
    });

    it(`fires onOpenChange when the disclosure toggles`, async () => {
        const user = userEvent.setup();
        const onOpenChange = vi.fn();
        render(
            <ExpandableSection
                header={`H`}
                testId={`s`}
                onOpenChange={onOpenChange}
            >
                <p>body</p>
            </ExpandableSection>
        );
        await user.click(screen.getByTestId(`s-trigger`));
        expect(onOpenChange).toHaveBeenLastCalledWith(true);
        await user.click(screen.getByTestId(`s-trigger`));
        expect(onOpenChange).toHaveBeenLastCalledWith(false);
    });

    it(`is fully controllable via open + onOpenChange`, async () => {
        const user = userEvent.setup();
        const Controlled = () => {
            const [open, setOpen] = useState(false);
            return (
                <>
                    <ExpandableSection
                        header={`H`}
                        testId={`s`}
                        open={open}
                        onOpenChange={setOpen}
                    >
                        <p>body</p>
                    </ExpandableSection>
                    <span data-testid={`o`}>{String(open)}</span>
                </>
            );
        };
        render(<Controlled />);
        expect(screen.getByTestId(`o`)).toHaveTextContent(`false`);
        await user.click(screen.getByTestId(`s-trigger`));
        expect(screen.getByTestId(`o`)).toHaveTextContent(`true`);
    });

    it(`defaultOpen renders the body on first paint`, () => {
        render(
            <ExpandableSection header={`H`} testId={`s`} defaultOpen>
                <p>body</p>
            </ExpandableSection>
        );
        expect(screen.getByText(`body`)).toBeInTheDocument();
    });

    it(`disclosure button advertises the right aria-label per state`, async () => {
        const user = userEvent.setup();
        render(
            <ExpandableSection
                header={`H`}
                testId={`s`}
                expandLabel={`Show`}
                collapseLabel={`Hide`}
            >
                <p>body</p>
            </ExpandableSection>
        );
        const trigger = screen.getByTestId(`s-trigger`);
        expect(trigger).toHaveAttribute(`aria-label`, `Show`);
        await user.click(trigger);
        expect(trigger).toHaveAttribute(`aria-label`, `Hide`);
    });

    it(`disabled sections do not expand on click and have no chevron`, async () => {
        const user = userEvent.setup();
        const onOpenChange = vi.fn();
        const { container } = render(
            <ExpandableSection
                header={`H`}
                testId={`s`}
                disabled
                onOpenChange={onOpenChange}
            >
                <p>body</p>
            </ExpandableSection>
        );
        const trigger = screen.getByTestId(`s-trigger`);
        expect(trigger).toBeDisabled();
        // No chevron SVG is rendered next to the header.
        expect(container.querySelector(`svg`)).toBeNull();
        await user.click(trigger);
        expect(onOpenChange).not.toHaveBeenCalled();
        expect(screen.queryByText(`body`)).toBeNull();
    });

    it(`disabled sections have no aria-label so screen readers don't promise a disclosure`, () => {
        render(
            <ExpandableSection
                header={`H`}
                testId={`s`}
                disabled
                expandLabel={`Show`}
            >
                <p>body</p>
            </ExpandableSection>
        );
        expect(screen.getByTestId(`s-trigger`)).not.toHaveAttribute(`aria-label`);
    });

    it(`renders a custom chevron when provided`, () => {
        render(
            <ExpandableSection
                header={`H`}
                testId={`s`}
                chevron={<span data-testid={`custom-chevron`}>↧</span>}
            >
                <p>body</p>
            </ExpandableSection>
        );
        expect(screen.getByTestId(`custom-chevron`)).toBeInTheDocument();
    });

    it(`hides the chevron when chevron={null}`, () => {
        const { container } = render(
            <ExpandableSection
                header={`H`}
                testId={`s`}
                chevron={null}
            >
                <p>body</p>
            </ExpandableSection>
        );
        expect(container.querySelector(`svg`)).toBeNull();
    });

    it(`omits the body wrapper entirely when children is undefined`, () => {
        render(
            <ExpandableSection header={`Header only`} testId={`s`} defaultOpen />
        );
        // No body wrapper rendered when there's nothing to disclose.
        expect(screen.queryByTestId(`s-body`)).toBeNull();
    });

    it(`forwards extra class names to the wrapper, trigger, and body`, async () => {
        const user = userEvent.setup();
        render(
            <ExpandableSection
                header={`H`}
                testId={`s`}
                className={`my-wrapper`}
                triggerClassName={`my-trigger`}
                contentClassName={`my-content`}
                defaultOpen
            >
                <p>body</p>
            </ExpandableSection>
        );
        expect(screen.getByTestId(`s`)).toHaveClass(`my-wrapper`);
        expect(screen.getByTestId(`s-trigger`)).toHaveClass(`my-trigger`);
        expect(screen.getByTestId(`s-body`)).toHaveClass(`my-content`);
        // toggle silences unused-var warning for `user`.
        await user.click(screen.getByTestId(`s-trigger`));
    });
});

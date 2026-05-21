import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import InlineEdit from "./InlineEdit";

const Controlled = ({ initial = `alpha`, onCommit }: { initial?: string; onCommit?: (s: string) => void }) => {
    const [value, setValue] = useState(initial);
    const handle = (s: string) => {
        onCommit?.(s);
        setValue(s);
    };
    return <InlineEdit value={value} onCommit={handle} ariaLabel={`field`} />;
};

it(`renders the current value in display mode`, () => {
    render(<Controlled initial={`alpha`} />);
    const editor = screen.getByRole(`textbox`, { name: `field` });
    expect(editor).toHaveTextContent(`alpha`);
    // Not focused / not editing → ring class should not be present.
    expect(editor.className).not.toContain(`ring-2`);
});

it(`commits on Enter with the trimmed value`, () => {
    const onCommit = vi.fn();
    render(<Controlled initial={`alpha`} onCommit={onCommit} />);
    const editor = screen.getByRole(`textbox`, { name: `field` });
    act(() => {
        editor.focus();
    });
    // Replace content via the contentEditable DOM API; the component reads
    // textContent on commit.
    editor.textContent = `  bravo  `;
    fireEvent.keyDown(editor, { key: `Enter` });
    act(() => {
        editor.blur();
    });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(`bravo`);
});

it(`cancels on Escape without firing onCommit`, () => {
    const onCommit = vi.fn();
    render(<Controlled initial={`alpha`} onCommit={onCommit} />);
    const editor = screen.getByRole(`textbox`, { name: `field` });
    act(() => {
        editor.focus();
    });
    editor.textContent = `bravo`;
    fireEvent.keyDown(editor, { key: `Escape` });
    expect(onCommit).not.toHaveBeenCalled();
    // The component restores the previous value on cancel.
    expect(editor.textContent).toBe(`alpha`);
});

it(`discards empty or unchanged values`, () => {
    const onCommit = vi.fn();
    render(<Controlled initial={`alpha`} onCommit={onCommit} />);
    const editor = screen.getByRole(`textbox`, { name: `field` });
    act(() => {
        editor.focus();
    });
    // Unchanged value
    fireEvent.keyDown(editor, { key: `Enter` });
    act(() => {
        editor.blur();
    });
    // Empty value
    act(() => {
        editor.focus();
    });
    editor.textContent = `   `;
    fireEvent.keyDown(editor, { key: `Enter` });
    act(() => {
        editor.blur();
    });
    expect(onCommit).not.toHaveBeenCalled();
});

it(`does not render edit / save / cancel buttons when disabled`, () => {
    render(
        <InlineEdit value={`read-only`} onCommit={() => {}} disabled ariaLabel={`field`} />
    );
    expect(screen.queryByRole(`button`, { name: `Edit` })).toBeNull();
    expect(screen.queryByRole(`button`, { name: `Save` })).toBeNull();
    expect(screen.queryByRole(`button`, { name: `Cancel` })).toBeNull();
});

it(`keeps the affordance column at a fixed width across states`, () => {
    const { container } = render(<Controlled initial={`alpha`} />);
    // The affordance column is the second child of the outer wrapper and
    // must carry the fixed-width token regardless of edit state.
    const outer = container.firstChild as HTMLElement;
    const affordance = outer.querySelector(`.grid.grid-cols-2`) as HTMLElement;
    expect(affordance).toBeTruthy();
    expect(affordance.className).toContain(`w-12`);
    // Switching to editing must not remove or alter that class.
    const editor = screen.getByRole(`textbox`, { name: `field` });
    act(() => {
        editor.focus();
    });
    expect(affordance.className).toContain(`w-12`);
});

it(`width prop locks the editor element to a fixed pixel width`, () => {
    render(
        <InlineEdit
            value={`alpha`}
            onCommit={() => {}}
            width={240}
            ariaLabel={`field`}
        />
    );
    const editor = screen.getByRole(`textbox`, { name: `field` });
    expect(editor.style.width).toBe(`240px`);
    // Overflow-clip + nowrap markers must be present so typing beyond the
    // box scrolls horizontally instead of expanding the editor.
    expect(editor.className).toContain(`overflow-hidden`);
    expect(editor.className).toContain(`whitespace-nowrap`);
});

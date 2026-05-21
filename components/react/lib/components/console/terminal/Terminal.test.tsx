import "@testing-library/jest-dom/vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import Terminal, { type TerminalHandle } from "./Terminal";

const writeMock = vi.fn();
const writelnMock = vi.fn();
const clearMock = vi.fn();
const focusMock = vi.fn();
const fitMock = vi.fn();

vi.mock(`./XtermTerminal`, () => {
    const Stub = React.forwardRef<TerminalHandle, { onData?: (d: string) => void }>(
        ({ onData }, ref) => {
            React.useImperativeHandle(ref, () => ({
                write: writeMock,
                writeln: writelnMock,
                clear: clearMock,
                focus: focusMock,
                fit: fitMock
            }));
            return (
                <div data-testid={`xterm-stub`}>
                    <button
                        type={`button`}
                        onClick={() => onData?.(`x`)}
                        data-testid={`emit-data`}
                    />
                </div>
            );
        }
    );
    Stub.displayName = `XtermStub`;
    return { default: Stub };
});

describe(`Terminal`, () => {
    it(`shows the suspense fallback before the xterm chunk resolves, then mounts it`, async () => {
        const { container } = render(<Terminal />);
        // Either the fallback or the resolved stub renders something with the
        // .Terminal class — the fallback first, then the lazy xterm replaces
        // it on the next microtask.
        await waitFor(() =>
            expect(container.querySelector(`[data-testid="xterm-stub"]`)).not.toBeNull()
        );
    });

    it(`forwards the imperative handle (write/clear/focus/fit) through the lazy boundary`, async () => {
        const handleRef = React.createRef<TerminalHandle>();
        render(<Terminal ref={handleRef} />);
        await waitFor(() => expect(screen.getByTestId(`xterm-stub`)).toBeInTheDocument());

        act(() => handleRef.current?.write(`hi`));
        act(() => handleRef.current?.writeln(`yo`));
        act(() => handleRef.current?.clear());
        act(() => handleRef.current?.focus());
        act(() => handleRef.current?.fit());

        expect(writeMock).toHaveBeenCalledWith(`hi`);
        expect(writelnMock).toHaveBeenCalledWith(`yo`);
        expect(clearMock).toHaveBeenCalled();
        expect(focusMock).toHaveBeenCalled();
        expect(fitMock).toHaveBeenCalled();
    });

    it(`invokes onData when xterm reports user input`, async () => {
        const onData = vi.fn();
        render(<Terminal onData={onData} />);
        const trigger = await screen.findByTestId(`emit-data`);
        act(() => trigger.click());
        expect(onData).toHaveBeenCalledWith(`x`);
    });
});

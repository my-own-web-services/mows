import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import MachineMonitor from "./MachineMonitor";

// We mock react-vnc — the actual library renders a canvas and opens a real
// WebSocket on mount, neither of which work under jsdom. The stub captures
// every render so we can verify how MachineMonitor forwards props and
// remounts on url change. This keeps our assertions on the real VncMonitor
// wrapper (which is the file under test for the readOnly / remount logic).
const screenRenderMock = vi.fn();
let mountedInstances = 0;

vi.mock(`react-vnc`, () => {
    interface StubProps {
        readonly url?: string;
        readonly viewOnly?: boolean;
        readonly focusOnClick?: boolean;
        readonly showDotCursor?: boolean;
        readonly autoConnect?: boolean;
    }
    const VncScreen = React.forwardRef<unknown, StubProps>((props, _ref) => {
        screenRenderMock(props);
        React.useEffect(() => {
            mountedInstances += 1;
            return () => {
                mountedInstances -= 1;
            };
        }, []);
        return (
            <div data-testid={`vnc-screen-stub`}>
                <span data-testid={`stub-url`}>{props.url ?? ``}</span>
                <span data-testid={`stub-viewonly`}>{String(!!props.viewOnly)}</span>
                <span data-testid={`stub-focus-on-click`}>{String(props.focusOnClick)}</span>
                <span data-testid={`stub-dot-cursor`}>{String(props.showDotCursor)}</span>
            </div>
        );
    });
    VncScreen.displayName = `VncScreenStub`;
    return { VncScreen };
});

describe(`MachineMonitor`, () => {
    it(`remounts the inner VncScreen when the url prop changes`, async () => {
        screenRenderMock.mockClear();
        mountedInstances = 0;

        const { rerender } = render(<MachineMonitor url={`ws://a:5900`} />);
        await waitFor(() =>
            expect(screen.getByTestId(`stub-url`)).toHaveTextContent(`ws://a:5900`)
        );
        // Exactly one VncScreen mounted at this point.
        expect(mountedInstances).toBe(1);

        rerender(<MachineMonitor url={`ws://b:5900`} />);
        await waitFor(() =>
            expect(screen.getByTestId(`stub-url`)).toHaveTextContent(`ws://b:5900`)
        );
        // The new VncScreen instance must replace the previous one. If
        // MachineMonitor merely passed the new url as a prop (no remount),
        // react-vnc would silently ignore it because its connect-effect runs
        // once with [] deps — that's the bug this test guards against.
        expect(mountedInstances).toBe(1);
        const calledWithNewUrl = screenRenderMock.mock.calls.some(
            (c) => c[0].url === `ws://b:5900`
        );
        expect(calledWithNewUrl).toBe(true);
    });

    it(`readOnly forces viewOnly + disables focusOnClick / dot cursor`, async () => {
        render(<MachineMonitor url={`ws://x:5900`} readOnly />);
        await waitFor(() => {
            expect(screen.getByTestId(`stub-viewonly`)).toHaveTextContent(`true`);
            expect(screen.getByTestId(`stub-focus-on-click`)).toHaveTextContent(`false`);
            expect(screen.getByTestId(`stub-dot-cursor`)).toHaveTextContent(`false`);
        });
    });

    it(`readOnly wraps the canvas in a pointer-events:none element`, async () => {
        const { container } = render(<MachineMonitor url={`ws://x:5900`} readOnly />);
        await waitFor(() => expect(screen.getByTestId(`vnc-screen-stub`)).toBeInTheDocument());

        // The stub is wrapped by VncMonitor's inner div, which must carry
        // pointer-events-none + select-none in readOnly mode so the
        // surrounding page keeps full control of mouse / scroll / focus.
        const stub = screen.getByTestId(`vnc-screen-stub`);
        const inner = stub.parentElement!;
        expect(inner.className).toContain(`pointer-events-none`);
        expect(inner.className).toContain(`select-none`);

        // Also: the outer MachineMonitor container is *not* the one with
        // pointer-events-none — that would defeat tooltips / overlays from
        // the consumer that sit on top of the monitor frame.
        const outer = container.querySelector(`.MachineMonitor`);
        expect(outer?.className ?? ``).not.toContain(`pointer-events-none`);
    });

    it(`does not set pointer-events:none when readOnly is omitted`, async () => {
        render(<MachineMonitor url={`ws://x:5900`} />);
        await waitFor(() => expect(screen.getByTestId(`vnc-screen-stub`)).toBeInTheDocument());

        const stub = screen.getByTestId(`vnc-screen-stub`);
        const inner = stub.parentElement!;
        expect(inner.className).not.toContain(`pointer-events-none`);

        // viewOnly defaults to falsy when neither viewOnly nor readOnly is set.
        expect(screen.getByTestId(`stub-viewonly`)).toHaveTextContent(`false`);
    });

    it(`explicit viewOnly is preserved when readOnly is not set`, async () => {
        render(<MachineMonitor url={`ws://x:5900`} viewOnly />);
        await waitFor(() =>
            expect(screen.getByTestId(`stub-viewonly`)).toHaveTextContent(`true`)
        );
        const stub = screen.getByTestId(`vnc-screen-stub`);
        const inner = stub.parentElement!;
        // viewOnly alone must not trigger the passive page wrapper.
        expect(inner.className).not.toContain(`pointer-events-none`);
    });
});

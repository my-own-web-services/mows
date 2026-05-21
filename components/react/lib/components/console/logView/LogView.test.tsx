import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import LogView from "./LogView";

describe(`LogView`, () => {
    const sampleLines = [
        `worker 0 listening on :8080`,
        `127.0.0.1 - - "GET /healthz HTTP/1.1" 200 2`,
        `[error] connection refused: db.mows.local:5432`
    ];

    it(`renders every line`, () => {
        render(<LogView lines={sampleLines} />);
        for (const line of sampleLines) {
            expect(screen.getByText(line)).toBeInTheDocument();
        }
    });

    it(`shows the empty placeholder when there are no lines`, () => {
        render(<LogView lines={[]} placeholders={{ empty: `nothing here` }} />);
        expect(screen.getByText(`nothing here`)).toBeInTheDocument();
    });

    it(`filters lines by case-insensitive substring`, async () => {
        const user = userEvent.setup();
        render(<LogView lines={sampleLines} />);
        const search = screen.getByPlaceholderText(`Filter…`);

        await user.type(search, `ERROR`);
        expect(
            screen.getByText(`[error] connection refused: db.mows.local:5432`)
        ).toBeInTheDocument();
        expect(screen.queryByText(`worker 0 listening on :8080`)).not.toBeInTheDocument();
    });

    it(`shows the empty placeholder when the filter matches nothing`, async () => {
        const user = userEvent.setup();
        render(<LogView lines={sampleLines} placeholders={{ empty: `nothing` }} />);
        await user.type(screen.getByPlaceholderText(`Filter…`), `xxx-no-match-xxx`);
        expect(screen.getByText(`nothing`)).toBeInTheDocument();
    });

    it(`hides the clear button when onClear is omitted`, () => {
        render(<LogView lines={sampleLines} />);
        expect(screen.queryByTitle(`Clear log`)).not.toBeInTheDocument();
    });

    it(`invokes onClear when the clear button is clicked`, async () => {
        const onClear = vi.fn();
        const user = userEvent.setup();
        render(<LogView lines={sampleLines} onClear={onClear} />);
        await user.click(screen.getByTitle(`Clear log`));
        expect(onClear).toHaveBeenCalledTimes(1);
    });

    it(`hides the toolbar when hideToolbar is set`, () => {
        render(<LogView lines={sampleLines} hideToolbar />);
        expect(screen.queryByPlaceholderText(`Filter…`)).not.toBeInTheDocument();
    });

    it(`reflects updated lines when the prop changes`, () => {
        const { rerender } = render(<LogView lines={[`a`]} />);
        expect(screen.getByText(`a`)).toBeInTheDocument();
        rerender(<LogView lines={[`a`, `b`]} />);
        expect(screen.getByText(`b`)).toBeInTheDocument();
    });
});

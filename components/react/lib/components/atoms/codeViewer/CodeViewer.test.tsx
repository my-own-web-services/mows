import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The actual editor is loaded via React.lazy(() => import("./MonacoCodeEditor")).
// Monaco needs canvas + workers + measureText APIs that jsdom doesn't ship,
// so we stub the dynamic import for unit tests. The runtime behaviour of the
// editor itself is exercised by the example app and Playwright e2e tests.
vi.mock("./MonacoCodeEditor", () => ({
    default: (props: { code: string; className?: string }) => (
        <div data-testid={`monaco-stub`} className={props.className}>
            {props.code}
        </div>
    )
}));

import CodeViewer from "./CodeViewer";

describe(`CodeViewer (lazy shim)`, () => {
    it(`renders the lazy-loaded editor with the supplied code`, async () => {
        render(<CodeViewer code={`{"a":1}`} language={`json`} />);
        const stub = await screen.findByTestId(`monaco-stub`);
        expect(stub).toBeInTheDocument();
        expect(stub).toHaveTextContent(`{"a":1}`);
    });

    it(`forwards className to the editor wrapper`, async () => {
        render(
            <CodeViewer
                code={`x`}
                language={`text`}
                className={`custom-class`}
            />
        );
        const stub = await screen.findByTestId(`monaco-stub`);
        expect(stub.className).toContain(`custom-class`);
    });
});

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The implementation lazily imports `@xyflow/react`, which needs canvas,
// `ResizeObserver` measurements, and pointer-event APIs that jsdom only
// stubs partially. Mock the lazy chunk so the shim contract is tested in
// isolation; live integration is covered by the example app + e2e tests.
vi.mock(`./NodeEditorImpl`, () => ({
    default: (props: { className?: string }) => (
        <div data-testid={`node-editor-stub`} className={props.className} />
    )
}));

import NodeEditor from "./NodeEditor";

describe(`NodeEditor (lazy shim)`, () => {
    it(`renders the lazy-loaded implementation`, async () => {
        render(<NodeEditor nodes={[]} edges={[]} />);
        const stub = await screen.findByTestId(`node-editor-stub`);
        expect(stub).toBeInTheDocument();
    });

    it(`forwards className to the implementation`, async () => {
        render(<NodeEditor nodes={[]} edges={[]} className={`custom-class`} />);
        const stub = await screen.findByTestId(`node-editor-stub`);
        expect(stub.className).toContain(`custom-class`);
    });
});

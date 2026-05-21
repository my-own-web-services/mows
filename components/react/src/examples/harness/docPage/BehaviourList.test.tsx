import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BehaviourList } from "./BehaviourList";

// CodeViewer pulls in monaco-editor which crashes under jsdom. We aren't
// testing the editor — only that the dialog opens with the right code
// string — so stub it to a plain <pre> we can inspect via its
// data-attributes. Same trick used by ExampleCard's tests.
vi.mock(`../../../../lib/components/code/codeViewer/CodeViewer`, () => ({
    default: (props: {
        code: string;
        language?: string;
        revealLine?: number;
    }) => (
        <pre
            data-testid={`code-viewer-stub`}
            data-language={props.language}
            data-reveal-line={props.revealLine}
        >
            {props.code}
        </pre>
    )
}));

const entries = [
    {
        statement: `does the thing`,
        // Pick a real test file in the repo so the `?raw` glob can
        // resolve it — picking a known small one keeps the dialog's
        // pre simple to assert against.
        testFile: `lib/components/code/expandableCode/ExpandableCode.test.tsx`,
        testLine: 1,
        testName: `mounts collapsed when content exceeds the collapsed height`
    }
];

describe(`BehaviourList`, () => {
    it(`renders one button per entry that opens a dialog with the test source`, async () => {
        render(<BehaviourList entries={entries} verifiedByLabel={`Verified by`} />);

        // Only the path:line chip is the clickable trigger — the
        // "verified by" label and the test-name suffix are static
        // context next to it.
        const triggers = screen.getAllByRole(`button`, {
            name: /Show test source/
        });
        expect(triggers).toHaveLength(1);
        expect(triggers[0]).toHaveTextContent(
            `${entries[0].testFile}:${entries[0].testLine}`
        );
        // The "verified by" prefix sits outside the button.
        expect(triggers[0]).not.toHaveTextContent(`Verified by`);

        // Dialog is closed initially.
        expect(screen.queryByRole(`dialog`)).toBeNull();

        fireEvent.click(triggers[0]);

        // Dialog opens immediately with the metadata even while the
        // import.meta.glob factory is still resolving.
        const dialog = await screen.findByRole(`dialog`);
        expect(dialog).toHaveTextContent(`"${entries[0].testName}"`);
        expect(dialog).toHaveTextContent(
            `${entries[0].testFile}:${entries[0].testLine}`
        );

        // After the async import resolves we get the CodeViewer with the
        // test's actual source — assert via the language + revealLine
        // we forwarded.
        const code = await screen.findByTestId(`code-viewer-stub`);
        expect(code).toHaveAttribute(`data-language`, `tsx`);
        expect(code).toHaveAttribute(`data-reveal-line`, String(entries[0].testLine));
        // Sanity: the resolved source is not empty and reads like a
        // vitest file (imports `describe`/`it`/`expect`).
        expect(code.textContent?.length ?? 0).toBeGreaterThan(0);
        expect(code.textContent ?? ``).toMatch(/describe|it\(/);
    });

    it(`shows a clear error when the test source path doesn't resolve`, async () => {
        render(
            <BehaviourList
                entries={[
                    {
                        statement: `does the thing`,
                        testFile: `lib/components/does-not/exist.test.tsx`,
                        testLine: 1,
                        testName: `phantom test`
                    }
                ]}
                verifiedByLabel={`Verified by`}
            />
        );
        fireEvent.click(screen.getByRole(`button`, { name: /Show test source/ }));
        await waitFor(() =>
            expect(screen.getByRole(`dialog`)).toHaveTextContent(
                `Test source not found`
            )
        );
    });
});

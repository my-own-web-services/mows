import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { MowsContext, type MowsContextType } from "../../../lib/lib/mowsContext/MowsContext";

// The real CodeViewer lazily loads Monaco, which never resolves in jsdom.
// Stub it with a plain <pre> so the rendered text is queryable.
vi.mock(`../../../lib/components/code/codeViewer/CodeViewer`, () => ({
    default: ({ code }: { code: string }) => <pre data-testid={`code`}>{code}</pre>
}));

import { ExampleCard } from "./ExampleCard";
import { useExampleState } from "./useExampleState";
import type { RegisteredExample } from "./types";

// Minimal context value — ExampleCard only reads `t.example.examples`, so a
// hand-rolled stub keeps the test focused on harness behaviour without
// having to spin up the full MowsProvider (OIDC, theme, hotkeys, …).
const stubContext = (): MowsContextType =>
    ({
        t: {
            example: {
                examples: {
                    _harness: {
                        codeTab: `Code`,
                        stateTab: `State`,
                        noStateReported: `no state reported`
                    },
                    fixture: {
                        title: `Title from translations`,
                        description: `Description from translations`
                    }
                }
            }
        }
    }) as unknown as MowsContextType;

const StatefulExample = () => {
    const [n, setN] = useState(0);
    useExampleState({ n });
    return (
        <button type={`button`} onClick={() => setN((v) => v + 1)}>
            tick {n}
        </button>
    );
};

const NoStateExample = () => <span>static</span>;

const wrap = (Example: RegisteredExample[`Example`]): RegisteredExample => ({
    id: `fixture`,
    source: `const x = 1;\n`,
    strings: (t) => (t as unknown as { examples: { fixture: { title: string; description: string } } }).examples.fixture,
    Example
});

const renderCard = (example: RegisteredExample) =>
    render(
        <MowsContext.Provider value={stubContext()}>
            <ExampleCard example={example} />
        </MowsContext.Provider>
    );

describe(`ExampleCard`, () => {
    it(`renders the resolved title and description`, () => {
        renderCard(wrap(NoStateExample));
        expect(screen.getByText(`Title from translations`)).toBeInTheDocument();
        expect(screen.getByText(`Description from translations`)).toBeInTheDocument();
    });

    it(`renders the example preview`, () => {
        renderCard(wrap(NoStateExample));
        expect(screen.getByText(`static`)).toBeInTheDocument();
    });

    it(`shows the no-state-reported placeholder when the example does not call useExampleState`, async () => {
        const user = userEvent.setup();
        renderCard(wrap(NoStateExample));
        await user.click(screen.getByRole(`tab`, { name: `State` }));
        expect(await screen.findByText(/no state reported/i)).toBeInTheDocument();
    });

    it(`reflects the example's reported state and updates after interaction`, async () => {
        const user = userEvent.setup();
        renderCard(wrap(StatefulExample));

        // The State tab content is the JSON; switch to it.
        await user.click(screen.getByRole(`tab`, { name: `State` }));
        // Initial state: { n: 0 }
        expect(await screen.findByText(/"n":\s*0/)).toBeInTheDocument();

        // Click the preview button to bump the state.
        await user.click(screen.getByRole(`button`, { name: /tick 0/ }));

        expect(await screen.findByText(/"n":\s*1/)).toBeInTheDocument();
    });
});

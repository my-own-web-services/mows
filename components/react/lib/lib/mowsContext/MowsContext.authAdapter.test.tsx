import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MowsProvider, useMows } from "./MowsContext";

// Liest die auth-Oberfläche aus dem Context (genau die Felder, die PrimaryMenu
// und coreActions konsumieren).
const Probe = () => {
    const mows = useMows();
    return (
        <div>
            <span data-testid="configured">{String(mows.authConfigured)}</span>
            <span data-testid="authed">{String(mows.auth?.isAuthenticated)}</span>
            <button type="button" onClick={() => void mows.auth.signinRedirect()}>
                signin
            </button>
            <button type="button" onClick={() => void mows.auth.signoutRedirect()}>
                signout
            </button>
        </div>
    );
};

describe(`MowsProvider custom authAdapter`, () => {
    it(`exposes the adapter through the same auth surface as OIDC`, async () => {
        const signIn = vi.fn();
        const signOut = vi.fn();
        // dnd={false}: no lazy DnD Suspense boundary, so the tree renders
        // synchronously (matches how a non-DnD app like firstdorsal embeds it).
        render(
            <MowsProvider
                storagePrefix={`adapter-test`}
                authAdapter={{ isAuthenticated: true, signIn, signOut }}
                dnd={false}
            >
                <Probe />
            </MowsProvider>
        );

        expect(screen.getByTestId(`configured`)).toHaveTextContent(`true`);
        expect(screen.getByTestId(`authed`)).toHaveTextContent(`true`);

        await userEvent.click(screen.getByText(`signin`));
        expect(signIn).toHaveBeenCalledTimes(1);
        await userEvent.click(screen.getByText(`signout`));
        expect(signOut).toHaveBeenCalledTimes(1);
    });

    it(`also works through the default lazy DnD gate (dnd not disabled)`, async () => {
        // With dnd defaulting true, the tree renders behind a lazy <DndGate>
        // Suspense boundary — content appears after the react-dnd chunk loads.
        render(
            <MowsProvider
                storagePrefix={`adapter-dnd-test`}
                authAdapter={{ isAuthenticated: true, signIn: vi.fn(), signOut: vi.fn() }}
            >
                <Probe />
            </MowsProvider>
        );
        expect(await screen.findByTestId(`authed`)).toHaveTextContent(`true`);
    })

    it(`without oidc and without adapter, auth is not configured`, () => {
        render(
            <MowsProvider storagePrefix={`no-auth-test`} dnd={false}>
                <Probe />
            </MowsProvider>
        );
        expect(screen.getByTestId(`configured`)).toHaveTextContent(`false`);
    });
});

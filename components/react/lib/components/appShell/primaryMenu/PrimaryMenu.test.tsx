import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { defaultCodeThemes } from "../../../lib/codeThemes";
import baseEnglishTranslation from "../../../lib/languages/en-US/default";
import { defaultMapStyles } from "../../../lib/mapStyles";
import { ActionManager } from "../../../lib/mowsContext/ActionManager";
import { HotkeyManager } from "../../../lib/mowsContext/HotkeyManager";
import {
    defaultCodeEditorSettings,
    defaultToastSettings,
    MowsContext,
    MowsProvider,
    type MowsContextType
} from "../../../lib/mowsContext/MowsContext";
import type { Translation } from "../../../lib/languages";
import PrimaryMenu from "./PrimaryMenu";

interface BuildOpts {
    readonly authConfigured: boolean;
    readonly isAuthenticated?: boolean;
}

const buildContext = ({ authConfigured, isAuthenticated = false }: BuildOpts): MowsContextType => {
    const actionManager = new ActionManager({
        recentActionsStorageKey: `test_recent`,
        maxRecentActions: 5
    });
    const hotkeyManager = new HotkeyManager(actionManager, {
        configStorageKey: `test_hotkeys`,
        defaultHotkeys: {}
    });

    return {
        // The PrimaryMenu only reads `auth.isAuthenticated` — a partial stub
        // is enough for these assertions.
         
        auth: { isAuthenticated } as any,
        authConfigured,
        mowsUser: null,
        storagePrefix: `test`,
        setTheme: async () => undefined,
        currentTheme: { id: `light`, name: `Light` },
        setLanguage: () => undefined,
        t: baseEnglishTranslation as Translation,
        currentLanguage: {
            code: `en-US`,
            originalName: `English`,
            englishName: `English`,
            emoji: ``,
            import: () => Promise.reject()
        },
        themes: [],
        languages: [],
        actionManager,
        hotkeyManager,
        currentlyOpenModal: undefined,
        changeActiveModal: () => undefined,
        codeThemes: defaultCodeThemes,
        currentCodeTheme: defaultCodeThemes[0],
        setCodeTheme: () => undefined,
        codeEditorSettings: defaultCodeEditorSettings,
        setCodeEditorSettings: () => undefined,
        toastSettings: defaultToastSettings,
        setToastSettings: () => undefined,
        mapStyles: defaultMapStyles,
        currentMapStyle: defaultMapStyles[0],
        setMapStyle: () => undefined
    };
};

const renderWithContext = (children: ReactNode, opts: BuildOpts) =>
    render(<MowsContext.Provider value={buildContext(opts)}>{children}</MowsContext.Provider>);

describe(`PrimaryMenu`, () => {
    it(`renders the Login item when auth is configured and the user is not signed in`, () => {
        renderWithContext(<PrimaryMenu defaultOpen />, { authConfigured: true });
        expect(
            screen.getByText(baseEnglishTranslation.primaryMenu.login)
        ).toBeInTheDocument();
    });

    it(`hides the Login item when auth is not configured`, () => {
        renderWithContext(<PrimaryMenu defaultOpen />, { authConfigured: false });
        expect(
            screen.queryByText(baseEnglishTranslation.primaryMenu.login)
        ).not.toBeInTheDocument();
    });

    it(`real MowsProvider mounted without an oidc prop yields authConfigured=false`, async () => {
        // This is the wiring test for the supervisor case: the host app does
        // not pass `oidc` at all. We exercise the real provider (not a hand-
        // rolled context value) and assert the live PrimaryMenu does not
        // render the Login affordance.
        render(
            <MowsProvider storagePrefix={`primary-menu-test`}>
                <PrimaryMenu defaultOpen />
            </MowsProvider>
        );

        // The dropdown's content is portaled, so wait for the menu to mount.
        await waitFor(() => {
            expect(
                screen.getByText(baseEnglishTranslation.primaryMenu.language)
            ).toBeInTheDocument();
        });
        expect(
            screen.queryByText(baseEnglishTranslation.primaryMenu.login)
        ).not.toBeInTheDocument();
    });

    it(`drops the leading separator when there is no auth section above it`, async () => {
        // When auth is not configured AND the user is (necessarily) not
        // logged in, the user-section of the dropdown is empty. The
        // separator that used to sit between user-section and language-
        // section must also disappear — an orphan rule at the top of the
        // menu looks broken.
        const { container } = renderWithContext(<PrimaryMenu defaultOpen />, {
            authConfigured: false
        });
        // Wait for the portaled menu content to mount.
        await waitFor(() =>
            expect(
                screen.getByText(baseEnglishTranslation.primaryMenu.language)
            ).toBeInTheDocument()
        );

        // Radix renders separators as elements with role="separator".
        const menuRoot = document.querySelector(`[role="menu"]`);
        expect(menuRoot).not.toBeNull();
        const separators = menuRoot!.querySelectorAll(`[role="separator"]`);
        const languageLabel = screen.getByText(baseEnglishTranslation.primaryMenu.language);
        for (const sep of separators) {
            // No separator may sit *above* the Language label without an
            // authenticated user or a Login item between them.
            const pos = sep.compareDocumentPosition(languageLabel);
            const sepIsBeforeLanguage = (pos & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
            if (sepIsBeforeLanguage) {
                // Anything before the language label must also be after a
                // visible auth item — but there is none, so this should be
                // unreachable.
                throw new Error(`Found orphan separator before language section`);
            }
        }
        // Silence unused-var lint warning on `container`.
        expect(container).toBeTruthy();
    });

    it(`keeps the separator when the Login item is visible`, async () => {
        renderWithContext(<PrimaryMenu defaultOpen />, { authConfigured: true });
        await waitFor(() =>
            expect(
                screen.getByText(baseEnglishTranslation.primaryMenu.login)
            ).toBeInTheDocument()
        );
        const menuRoot = document.querySelector(`[role="menu"]`);
        const loginItem = screen.getByText(baseEnglishTranslation.primaryMenu.login);
        const languageLabel = screen.getByText(baseEnglishTranslation.primaryMenu.language);

        const separators = Array.from(menuRoot!.querySelectorAll(`[role="separator"]`));
        const between = separators.find((sep) => {
            const afterLogin =
                (loginItem.compareDocumentPosition(sep) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
            const beforeLanguage =
                (sep.compareDocumentPosition(languageLabel) & Node.DOCUMENT_POSITION_FOLLOWING) !==
                0;
            return afterLogin && beforeLanguage;
        });
        expect(between).toBeDefined();
    });

    it(`inline variant renders trigger full-width without fixed positioning and shows the user name when logged in`, () => {
        const { container } = renderWithContext(
            <PrimaryMenu variant={`inline`} user={{ displayName: `Ada Lovelace` }} />,
            { authConfigured: true, isAuthenticated: true }
        );
        const wrapper = container.querySelector(`.PrimaryMenu`);
        expect(wrapper).not.toBeNull();
        expect(wrapper!.className).not.toMatch(/fixed/);
        expect(wrapper!.className).toMatch(/w-full/);
        // The display name is rendered next to the avatar in the trigger.
        expect(screen.getByText(`Ada Lovelace`)).toBeInTheDocument();
    });

    it(`inline variant renders the menu icon (no text label) + chevron when logged out`, () => {
        const { container } = renderWithContext(<PrimaryMenu variant={`inline`} />, {
            authConfigured: true
        });
        const wrapper = container.querySelector(`.PrimaryMenu`);
        expect(wrapper).not.toBeNull();
        expect(wrapper!.className).not.toMatch(/fixed/);
        // Logged-out inline trigger is icon + spacer + chevron — no text
        // label. (`primaryMenu.openMenu` lives on the trigger's `title`
        // attribute as a tooltip / a11y hint, not in the trigger's text.)
        const trigger = wrapper!.querySelector(`[aria-haspopup]`);
        expect(trigger).not.toBeNull();
        expect(trigger!.textContent?.trim()).toBe(``);
    });

    it(`inline variant highlights the whole bar (not just the inner trigger) on hover/focus/open`, () => {
        // The sidebar's bottom bar must light up as a single button. We park
        // the hover/focus/data-state styling on the wrapper via CSS
        // `:has(button…)` selectors so the highlight covers edge-to-edge
        // regardless of which child the cursor actually lands on.
        const { container } = renderWithContext(<PrimaryMenu variant={`inline`} />, {
            authConfigured: true
        });
        const wrapper = container.querySelector(`.PrimaryMenu`);
        expect(wrapper).not.toBeNull();
        const cls = wrapper!.className;
        expect(cls).toMatch(/has-\[button:hover\]:bg-sidebar-accent/);
        expect(cls).toMatch(/has-\[button:focus-visible\]:bg-sidebar-accent/);
        expect(cls).toMatch(/has-\[button\[data-state=open\]\]:bg-sidebar-accent/);
    });

    it(`inline variant menu icon has no per-icon hover so the wrapper highlight is not doubled`, () => {
        // Regression: when the wrapper drives the highlight, the burger
        // icon must not also lighten on hover — otherwise the icon flashes
        // an extra "icon-only" bright state on top of the bar background.
        const { container } = renderWithContext(<PrimaryMenu variant={`inline`} />, {
            authConfigured: true
        });
        const wrapper = container.querySelector(`.PrimaryMenu`);
        const burger = wrapper!.querySelector(`svg`);
        expect(burger).not.toBeNull();
        const burgerCls = burger!.getAttribute(`class`) ?? ``;
        expect(burgerCls).not.toMatch(/hover:text-/);
    });

    it(`fixed variant menu icon keeps its own hover affordance`, () => {
        // Fixed mode is a free-floating circular trigger with no wrapper
        // highlight, so the icon owns its own per-pixel hover treatment.
        const { container } = renderWithContext(<PrimaryMenu variant={`fixed`} />, {
            authConfigured: true
        });
        const wrapper = container.querySelector(`.PrimaryMenu`);
        const burger = wrapper!.querySelector(`svg`);
        expect(burger).not.toBeNull();
        const burgerCls = burger!.getAttribute(`class`) ?? ``;
        expect(burgerCls).toMatch(/hover:text-foreground/);
    });

    it(`treats an authenticated session as logged out when auth is not configured`, () => {
        // If a stale OIDC session is still cached but the app no longer wires
        // up an `oidc` config, we must not show the user-menu (Logout etc.) —
        // the only safe assumption is "no auth at all".
        renderWithContext(<PrimaryMenu defaultOpen />, {
            authConfigured: false,
            isAuthenticated: true
        });
        expect(
            screen.queryByText(baseEnglishTranslation.primaryMenu.login)
        ).not.toBeInTheDocument();
        expect(
            screen.queryByText(baseEnglishTranslation.primaryMenu.logout)
        ).not.toBeInTheDocument();
    });
});

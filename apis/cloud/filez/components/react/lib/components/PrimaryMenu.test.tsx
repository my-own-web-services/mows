import { FilezProvider } from "@/lib/filezContext/FilezContext";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import PrimaryMenu from "./PrimaryMenu";

// Helper function to navigate to a specific menu item using arrow keys
const keyboardNavigateToMenuItem = async (
    user: ReturnType<typeof userEvent.setup>,
    targetSelector: string,
    maxAttempts = 10
) => {
    for (let i = 0; i < maxAttempts; i++) {
        // Check if we've found the target element
        const targetElement = document.querySelector(targetSelector);
        if (
            targetElement &&
            (document.activeElement === targetElement ||
                targetElement.contains(document.activeElement!))
        ) {
            return targetElement;
        }

        // Move to next menu item
        await user.keyboard(`{ArrowDown}`);
    }

    throw new Error(
        `Could not navigate to menu item matching selector: ${targetSelector} after ${maxAttempts} attempts`
    );
};

test(`PrimaryMenu component renders`, async () => {
    render(
        <FilezProvider>
            <PrimaryMenu />
        </FilezProvider>
    );

    // Wait for the menu button to appear
    const menuButton = await screen.findByRole(`button`, { name: /open menu/i });
    expect(menuButton).toBeInTheDocument();

    // Check if the menu button has correct ARIA attributes
    expect(menuButton).toHaveAttribute(`aria-expanded`, `false`);
    expect(menuButton).toHaveAttribute(`aria-haspopup`, `menu`);

    // Check if the hamburger icon is present
    const hamburgerIcon = screen.getByRole(`button`).querySelector(`svg`);
    expect(hamburgerIcon).toBeInTheDocument();
});

test(`menu expands when clicked`, async () => {
    const user = userEvent.setup();
    render(
        <FilezProvider>
            <PrimaryMenu />
        </FilezProvider>
    );

    // Wait for the menu button to appear
    const menuButton = await screen.findByRole(`button`, { name: /open menu/i });

    // Initially menu should be closed
    expect(menuButton).toHaveAttribute(`aria-expanded`, `false`);

    // Click the menu button
    await user.click(menuButton);

    // Wait for menu to open and show login option
    await waitFor(() => {
        expect(menuButton).toHaveAttribute(`aria-expanded`, `true`);
    });

    // Should show menu content (login option for non-authenticated user)
    expect(await screen.findByText(/login/i)).toBeInTheDocument();
});

test(`menu expands when Enter key is pressed`, async () => {
    const user = userEvent.setup();
    render(
        <FilezProvider>
            <PrimaryMenu />
        </FilezProvider>
    );

    // Wait for the menu button to appear
    const menuButton = await screen.findByRole(`button`, { name: /open menu/i });

    // Initially menu should be closed
    expect(menuButton).toHaveAttribute(`aria-expanded`, `false`);

    // Focus the button and press Enter
    menuButton.focus();
    await user.keyboard(`{Enter}`);

    // Wait for menu to open
    await waitFor(() => {
        expect(menuButton).toHaveAttribute(`aria-expanded`, `true`);
    });

    // Should show menu content (login option for non-authenticated user)
    expect(await screen.findByText(/login/i)).toBeInTheDocument();
});

test(`all menu items are keyboard accessible`, async () => {
    const user = userEvent.setup();
    render(
        <FilezProvider>
            <PrimaryMenu />
        </FilezProvider>
    );

    // Wait for the menu button to appear
    const menuButton = await screen.findByRole(`button`, { name: /open menu/i });

    // Open menu with keyboard
    menuButton.focus();
    await user.keyboard(`{Enter}`);

    // Wait for menu to open
    await waitFor(() => {
        expect(menuButton).toHaveAttribute(`aria-expanded`, `true`);
    });

    // Check that all menu items are focusable
    const loginItem = await screen.findByRole(`menuitem`, { name: /login/i });
    expect(loginItem).toBeInTheDocument();

    // Check that language picker is accessible
    const languagePicker = screen.getByRole(`menuitem`, { name: /english.*us/i });
    expect(languagePicker).toBeInTheDocument();

    // Check that theme picker is accessible
    const themePicker = screen.getByRole(`menuitem`, { name: /system/i });
    expect(themePicker).toBeInTheDocument();

    // Check that keyboard shortcuts is accessible
    const keyboardShortcuts = screen.getByRole(`menuitem`, { name: /keyboard shortcuts/i });
    expect(keyboardShortcuts).toBeInTheDocument();

    // Check that developer tools is accessible
    const devTools = screen.getByRole(`menuitem`, { name: /developer tools/i });
    expect(devTools).toBeInTheDocument();
});

test(`can navigate menu items with arrow keys`, async () => {
    const user = userEvent.setup();
    render(
        <FilezProvider>
            <PrimaryMenu />
        </FilezProvider>
    );

    // Open menu
    const menuButton = await screen.findByRole(`button`, { name: /open menu/i });
    await user.click(menuButton);

    await waitFor(() => {
        expect(menuButton).toHaveAttribute(`aria-expanded`, `true`);
    });

    // Focus should start on first menu item (login)
    const loginItem = await screen.findByRole(`menuitem`, { name: /login/i });
    loginItem.focus();
    expect(document.activeElement).toBe(loginItem);

    // Navigate down with arrow key
    await user.keyboard(`{ArrowDown}`);

    // Should focus next focusable item
    await waitFor(() => {
        const focusedElement = document.activeElement;
        expect(focusedElement).not.toBe(loginItem);
        expect(focusedElement?.getAttribute(`role`)).toBe(`menuitem`);
    });
});

test(`can activate menu items with Enter key`, async () => {
    const user = userEvent.setup();
    render(
        <FilezProvider>
            <PrimaryMenu />
        </FilezProvider>
    );

    // Open menu
    const menuButton = await screen.findByRole(`button`, { name: /open menu/i });
    await user.click(menuButton);

    await waitFor(() => {
        expect(menuButton).toHaveAttribute(`aria-expanded`, `true`);
    });

    // Focus on keyboard shortcuts item
    const keyboardShortcutsItem = await screen.findByRole(`menuitem`, {
        name: /keyboard shortcuts/i
    });
    keyboardShortcutsItem.focus();

    // Verify it's focused
    expect(document.activeElement).toBe(keyboardShortcutsItem);

    // Press Enter to activate
    await user.keyboard(`{Enter}`);

    // After pressing Enter, the menu should close (which is normal behavior)
    await waitFor(() => {
        expect(menuButton).toHaveAttribute(`aria-expanded`, `false`);
    });
});

test(`can close menu with Escape key`, async () => {
    const user = userEvent.setup();
    render(
        <FilezProvider>
            <PrimaryMenu />
        </FilezProvider>
    );

    // Open menu
    const menuButton = await screen.findByRole(`button`, { name: /open menu/i });
    await user.click(menuButton);

    await waitFor(() => {
        expect(menuButton).toHaveAttribute(`aria-expanded`, `true`);
    });

    // Press Escape to close
    await user.keyboard(`{Escape}`);

    // Menu should be closed
    await waitFor(() => {
        expect(menuButton).toHaveAttribute(`aria-expanded`, `false`);
    });
});

test(`can open language picker with keyboard`, async () => {
    const user = userEvent.setup();
    render(
        <FilezProvider>
            <PrimaryMenu />
        </FilezProvider>
    );

    // Open the main menu with keyboard
    const menuButton = await screen.findByRole(`button`, { name: /open menu/i });
    menuButton.focus();
    await user.keyboard(`{Enter}`);

    await waitFor(() => {
        expect(menuButton).toHaveAttribute(`aria-expanded`, `true`);
    });

    // Navigate to language picker using helper function
    await keyboardNavigateToMenuItem(user, `[title="Select language"]`);

    // Press Enter to open the language picker
    await user.keyboard(`{Enter}`);

    // Wait for language picker dialog to open
    await waitFor(() => {
        expect(screen.getByRole(`dialog`)).toBeInTheDocument();
    });

    // Should show command input for searching languages
    const searchInput = screen.getByRole(`combobox`);
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveAttribute(`placeholder`, `Select language`);
});

test(`can search and navigate languages with keyboard`, async () => {
    const user = userEvent.setup();
    render(
        <FilezProvider>
            <PrimaryMenu />
        </FilezProvider>
    );

    // Open menu with keyboard
    const menuButton = await screen.findByRole(`button`, { name: /open menu/i });
    menuButton.focus();
    await user.keyboard(`{Enter}`);

    // Navigate to language picker using helper function
    await keyboardNavigateToMenuItem(user, `[title="Select language"]`);

    // Open language picker with Enter
    await user.keyboard(`{Enter}`);

    // Wait for language picker dialog
    await waitFor(() => {
        expect(screen.getByRole(`dialog`)).toBeInTheDocument();
    });

    // The search input should be focused automatically
    const searchInput = screen.getByRole(`combobox`);
    expect(document.activeElement).toBe(searchInput);

    // Type "ger" to search for German
    await user.type(searchInput, `ger`);

    // Should show German language option
    await waitFor(() => {
        expect(screen.getByText(/deutsch/i)).toBeInTheDocument();
        expect(screen.getByText(/german/i)).toBeInTheDocument();
    });

    // Use arrow key to navigate to the German option
    await user.keyboard(`{ArrowDown}`);

    // In command components, focus stays on input but arrow keys control selection
    await waitFor(() => {
        const focusedElement = document.activeElement;
        expect(focusedElement).toBeTruthy();

        // Verify German option is present and selectable
        const germanOption = screen.getByText(/deutsch/i).closest(`[role="option"]`);
        expect(germanOption).toBeInTheDocument();
    });
});

test(`can select German language with keyboard and verify change`, async () => {
    const user = userEvent.setup();
    render(
        <FilezProvider>
            <PrimaryMenu />
        </FilezProvider>
    );

    // Open menu with keyboard and verify current language is English
    const menuButton = await screen.findByRole(`button`, { name: /open menu/i });
    menuButton.focus();
    await user.keyboard(`{Enter}`);

    await waitFor(() => {
        expect(menuButton).toHaveAttribute(`aria-expanded`, `true`);
        const currentLanguagePicker = screen.getByRole(`menuitem`, { name: /english.*us/i });
        expect(currentLanguagePicker).toBeInTheDocument();
    });

    // Verify initial English text in menu elements before language change
    const loginTextEnglish = await screen.findByText(`Login`);
    const languageLabelEnglish = await screen.findByText(`Language`);
    expect(loginTextEnglish).toBeInTheDocument();
    expect(languageLabelEnglish).toBeInTheDocument();

    // Navigate to language picker using helper function
    await keyboardNavigateToMenuItem(user, `[title="Select language"]`);

    // Open language picker with Enter
    await user.keyboard(`{Enter}`);

    await waitFor(() => {
        expect(screen.getByRole(`dialog`)).toBeInTheDocument();
    });

    // Search for German - input should be automatically focused
    const searchInput = screen.getByRole(`combobox`);
    expect(document.activeElement).toBe(searchInput);
    await user.type(searchInput, `ger`);

    // Navigate to the German option using arrow keys
    await user.keyboard(`{ArrowDown}`);

    // In Command components, focus stays on input but arrow keys control selection
    await waitFor(() => {
        // Verify German option is present and selectable
        const germanOption = screen.getByText(/deutsch/i).closest(`[role="option"]`);
        expect(germanOption).toBeInTheDocument();
    });

    // Select German using Enter key
    await user.keyboard(`{Enter}`);

    // Language picker dialog should close
    await waitFor(() => {
        expect(screen.queryByRole(`dialog`)).not.toBeInTheDocument();
    });

    // Main menu should still be open, and language should now show as German
    await waitFor(() => {
        expect(menuButton).toHaveAttribute(`aria-expanded`, `true`);
        // The language picker should now show German instead of English
        expect(screen.getByRole(`menuitem`, { name: /deutsch/i })).toBeInTheDocument();
    });

    // Verify that the language actually changed by checking translated text elements
    await waitFor(() => {
        // Check that at least two elements have adopted the new German language
        const loginTextGerman = screen.getByText(`Anmelden`);
        const languageLabelGerman = screen.getByText(`Sprache`);

        expect(loginTextGerman).toBeInTheDocument();
        expect(languageLabelGerman).toBeInTheDocument();

        // Verify the English text is no longer present
        expect(screen.queryByText(`Login`)).not.toBeInTheDocument();
        expect(screen.queryByText(`Language`)).not.toBeInTheDocument();
    });
});

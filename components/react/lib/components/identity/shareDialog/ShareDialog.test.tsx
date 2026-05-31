import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ShareDialog } from "./ShareDialog";
import { SENTINEL_UUID } from "./types";
import type {
    ShareActionOption,
    ShareSubjectOption
} from "./types";

const ALICE: ShareSubjectOption = {
    kind: "user",
    id: "a11ce000-0000-0000-0000-000000000001",
    label: "Alice"
};
const BOB: ShareSubjectOption = {
    kind: "user",
    id: "b0b00000-0000-0000-0000-000000000002",
    label: "Bob",
    description: "bob@example.com"
};
const TEAM_A: ShareSubjectOption = {
    kind: "userGroup",
    id: "11111111-1111-1111-1111-111111111111",
    label: "team-a",
    description: "3 members"
};
const PUBLIC_SENTINEL: ShareSubjectOption = {
    kind: "public",
    id: SENTINEL_UUID,
    label: "Public"
};
const SERVER_MEMBER_SENTINEL: ShareSubjectOption = {
    kind: "serverMember",
    id: SENTINEL_UUID,
    label: "Server members"
};

const READ: ShareActionOption = {
    id: "ChannelsRead",
    label: "Read",
    description: "Read messages",
    implies: ["ChannelsList"]
};
const LIST: ShareActionOption = {
    id: "ChannelsList",
    label: "List",
    description: "See this channel in the sidebar"
};
const PUBLISH: ShareActionOption = {
    id: "ChannelsPublish",
    label: "Publish",
    description: "Send messages"
};
const ACTIONS = [READ, LIST, PUBLISH] as const;

const renderDialog = (overrides: Partial<React.ComponentProps<typeof ShareDialog>> = {}) => {
    const onShare = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    const props = {
        open: true,
        onOpenChange,
        resourceLabel: "channel #team-room",
        subjects: [ALICE, BOB, TEAM_A, PUBLIC_SENTINEL, SERVER_MEMBER_SENTINEL],
        actions: ACTIONS,
        onShare,
        ...overrides
    };
    return { ...render(<ShareDialog {...props} />), onShare, onOpenChange };
};

describe("ShareDialog", () => {
    it("renders the resource label in the title", () => {
        renderDialog();
        expect(screen.getByText("Share channel #team-room")).toBeInTheDocument();
    });

    it("surfaces every subject kind that has at least one option as its own tab", () => {
        renderDialog();
        // 4 kinds present in the fixture → 4 tabs.
        const tabs = screen.getAllByRole("tab");
        expect(tabs).toHaveLength(4);
        expect(tabs.map((t) => t.textContent)).toEqual(
            expect.arrayContaining([
                expect.stringContaining("User"),
                expect.stringContaining("User group"),
                expect.stringContaining("Anyone with the link"),
                expect.stringContaining("Anyone on this server")
            ])
        );
    });

    it("does NOT render a tab for a kind with zero subjects", () => {
        // Only users available — no userGroup / public / serverMember.
        renderDialog({ subjects: [ALICE, BOB] });
        const tabs = screen.getAllByRole("tab");
        expect(tabs).toHaveLength(1);
        expect(tabs[0]).toHaveTextContent("User");
    });

    it("excludes ids supplied via excludeSubjectIds (the acting-user filter)", () => {
        // Alice is excluded; the user-tab picker should not list her.
        const { container } = renderDialog({ excludeSubjectIds: [ALICE.id] });
        // Open the picker.
        const trigger = container.querySelector('[role="combobox"]');
        if (trigger) fireEvent.click(trigger);
        // Alice must NOT appear in the popover; Bob must.
        expect(screen.queryByText("Alice")).not.toBeInTheDocument();
    });

    it("auto-checks implied actions when a parent action is checked", async () => {
        renderDialog();
        const readCheckbox = screen.getByLabelText(/^Read/, { selector: "button" });
        const listCheckbox = screen.getByLabelText(/^List/, { selector: "button" });
        expect(readCheckbox).toHaveAttribute("aria-checked", "false");
        expect(listCheckbox).toHaveAttribute("aria-checked", "false");
        fireEvent.click(readCheckbox);
        // Read implies List → checking Read must also check List
        // (this is the realtime chat review B2 / SEC-4 bug pattern
        // the dialog must enforce by design).
        await waitFor(() =>
            expect(readCheckbox).toHaveAttribute("aria-checked", "true")
        );
        expect(listCheckbox).toHaveAttribute("aria-checked", "true");
    });

    it("does NOT cascade an uncheck back through implications", async () => {
        renderDialog({ initialActionIds: ["ChannelsRead"] });
        // initialActionIds runs through the closure so List is on too.
        const listCheckbox = screen.getByLabelText(/^List/, { selector: "button" });
        await waitFor(() =>
            expect(listCheckbox).toHaveAttribute("aria-checked", "true")
        );
        fireEvent.click(listCheckbox);
        // Unchecking List must NOT auto-uncheck Read — the user
        // might legitimately want Read without List (rare, but the
        // dialog shouldn't pretend to know which way the user
        // meant). Read stays checked.
        await waitFor(() =>
            expect(listCheckbox).toHaveAttribute("aria-checked", "false")
        );
        const readCheckbox = screen.getByLabelText(/^Read/, { selector: "button" });
        expect(readCheckbox).toHaveAttribute("aria-checked", "true");
    });

    it("blocks submit until a subject is picked", async () => {
        // Switching tabs deliberately clears the selection (so a
        // user explicitly picks within the new kind, never has
        // WHO they're sharing with silently change). After
        // switching from User to UserGroup and immediately
        // submitting, selectedSubject is undefined →
        // errorPickSubject fires. Radix Tabs needs a real pointer
        // interaction (pointer events + capture) to flip the
        // controlled value in JSDOM; userEvent.click drives it
        // where fireEvent.click stalls (Radix internally listens
        // on `pointerdown` + `mouseup` for keyboard-vs-mouse
        // disambiguation).
        const user = userEvent.setup();
        const { onShare } = renderDialog({
            subjects: [BOB, TEAM_A],
            initialActionIds: ["ChannelsRead"]
        });
        const userGroupTab = screen.getByRole("tab", { name: /User group/ });
        await user.click(userGroupTab);
        await waitFor(() =>
            expect(userGroupTab).toHaveAttribute("data-state", "active")
        );
        await user.click(screen.getByRole("button", { name: /^Share$/ }));
        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent(/Pick someone to share with/);
        expect(onShare).not.toHaveBeenCalled();
    });

    it("blocks submit until at least one action is checked", async () => {
        // Initial subject present (Alice), no actions checked.
        const { onShare } = renderDialog({
            subjects: [BOB],
            initialSubjectId: BOB.id
        });
        fireEvent.click(screen.getByRole("button", { name: /^Share$/ }));
        await screen.findByRole("alert");
        expect(screen.getByRole("alert")).toHaveTextContent(
            /Grant at least one action/
        );
        expect(onShare).not.toHaveBeenCalled();
    });

    it("returns actions in the prop-defined order, not click-order", async () => {
        const { onShare } = renderDialog({ subjects: [BOB], initialSubjectId: BOB.id });
        // Click Publish first, then Read (which implies List).
        // Submitted actions must come back ordered [Read, List, Publish]
        // — the order in the `actions` prop — not click order. The
        // engine's ARRAY equality is order-sensitive and tests
        // around access policies expect a deterministic shape.
        fireEvent.click(screen.getByLabelText(/^Publish/, { selector: "button" }));
        fireEvent.click(screen.getByLabelText(/^Read/, { selector: "button" }));
        fireEvent.click(screen.getByRole("button", { name: /^Share$/ }));
        await waitFor(() => expect(onShare).toHaveBeenCalledTimes(1));
        expect(onShare).toHaveBeenCalledWith({
            subject: BOB,
            actions: ["ChannelsRead", "ChannelsList", "ChannelsPublish"],
            effect: "Allow"
        });
    });

    it("renders the Allow/Deny toggle only when allowDeny is true", () => {
        const { rerender } = renderDialog();
        expect(screen.queryByText("Effect")).not.toBeInTheDocument();
        rerender(
            <ShareDialog
                open
                onOpenChange={() => {}}
                resourceLabel="x"
                subjects={[BOB]}
                actions={ACTIONS}
                allowDeny
                onShare={async () => {}}
            />
        );
        expect(screen.getByText("Effect")).toBeInTheDocument();
        expect(screen.getByLabelText(/^Allow/)).toBeInTheDocument();
        expect(screen.getByLabelText(/^Deny/)).toBeInTheDocument();
    });

    it("auto-selects the sentinel subject when the Public tab is picked", async () => {
        const { onShare } = renderDialog({ subjects: [PUBLIC_SENTINEL] });
        // Only Public available → only Public tab → already selected.
        fireEvent.click(screen.getByLabelText(/^Read/, { selector: "button" }));
        fireEvent.click(screen.getByRole("button", { name: /^Share$/ }));
        await waitFor(() => expect(onShare).toHaveBeenCalledTimes(1));
        expect(onShare).toHaveBeenCalledWith({
            subject: PUBLIC_SENTINEL,
            actions: ["ChannelsRead", "ChannelsList"],
            effect: "Allow"
        });
    });

    it("keeps the dialog open and surfaces the error message when onShare rejects", async () => {
        const onShare = vi.fn().mockRejectedValue(new Error("backend said no"));
        const onOpenChange = vi.fn();
        render(
            <ShareDialog
                open
                onOpenChange={onOpenChange}
                resourceLabel="x"
                subjects={[BOB]}
                initialSubjectId={BOB.id}
                actions={ACTIONS}
                initialActionIds={["ChannelsPublish"]}
                onShare={onShare}
            />
        );
        fireEvent.click(screen.getByRole("button", { name: /^Share$/ }));
        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent("backend said no");
        // Dialog must stay open so the user can retry.
        expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });

    it("resets the form state on each re-open", async () => {
        const { rerender } = render(
            <ShareDialog
                open
                onOpenChange={() => {}}
                resourceLabel="x"
                subjects={[BOB]}
                initialSubjectId={BOB.id}
                actions={ACTIONS}
                initialActionIds={["ChannelsPublish"]}
                onShare={async () => {}}
            />
        );
        // Confirm initial state.
        const publishBefore = screen.getByLabelText(/^Publish/, { selector: "button" });
        expect(publishBefore).toHaveAttribute("aria-checked", "true");
        // User toggles publish off (mutates internal state).
        fireEvent.click(publishBefore);
        await waitFor(() =>
            expect(publishBefore).toHaveAttribute("aria-checked", "false")
        );
        // Close + reopen.
        rerender(
            <ShareDialog
                open={false}
                onOpenChange={() => {}}
                resourceLabel="x"
                subjects={[BOB]}
                initialSubjectId={BOB.id}
                actions={ACTIONS}
                initialActionIds={["ChannelsPublish"]}
                onShare={async () => {}}
            />
        );
        rerender(
            <ShareDialog
                open
                onOpenChange={() => {}}
                resourceLabel="x"
                subjects={[BOB]}
                initialSubjectId={BOB.id}
                actions={ACTIONS}
                initialActionIds={["ChannelsPublish"]}
                onShare={async () => {}}
            />
        );
        // initialActionIds reapplied — Publish back on.
        const publishAfter = screen.getByLabelText(/^Publish/, { selector: "button" });
        await waitFor(() =>
            expect(publishAfter).toHaveAttribute("aria-checked", "true")
        );
    });

    // ---- Round-1 review additions ----

    it("submits with effect: 'Deny' when the Deny radio is selected (review R2)", async () => {
        const user = userEvent.setup();
        const { onShare } = renderDialog({
            subjects: [BOB],
            initialSubjectId: BOB.id,
            allowDeny: true,
            initialActionIds: ["ChannelsRead"]
        });
        // Click the Deny radio, then submit.
        await user.click(screen.getByLabelText(/^Deny/));
        await user.click(screen.getByRole("button", { name: /^Share$/ }));
        await waitFor(() => expect(onShare).toHaveBeenCalledTimes(1));
        expect(onShare).toHaveBeenCalledWith({
            subject: BOB,
            actions: ["ChannelsRead", "ChannelsList"],
            effect: "Deny"
        });
    });

    it("renders the no-subjects empty state and disables submit when subjects is [] (review R6)", () => {
        const onShare = vi.fn().mockResolvedValue(undefined);
        render(
            <ShareDialog
                open
                onOpenChange={() => {}}
                resourceLabel="x"
                subjects={[]}
                actions={ACTIONS}
                onShare={onShare}
            />
        );
        // The empty-state status renders…
        const status = screen.getByRole("status");
        expect(status).toHaveTextContent(/Nothing to share with/);
        // …no subject tabs are rendered…
        expect(screen.queryAllByRole("tab")).toHaveLength(0);
        // …and submit is disabled so the user can't trigger errorPickSubject
        // against an empty surface (a silent footgun in the pre-R6 build).
        const shareButton = screen.getByRole("button", { name: /^Share$/ });
        expect(shareButton).toBeDisabled();
    });

    it("falls back to the first available subject when initialSubjectId doesn't match (review R11)", async () => {
        const { onShare } = renderDialog({
            subjects: [BOB],
            initialSubjectId: "00000000-0000-0000-0000-deadbeefdead",
            initialActionIds: ["ChannelsRead"]
        });
        // Fallback target is BOB (the first available subject of the
        // first available kind). Submit and check the payload.
        await userEvent.setup().click(screen.getByRole("button", { name: /^Share$/ }));
        await waitFor(() => expect(onShare).toHaveBeenCalledTimes(1));
        expect(onShare.mock.calls[0][0].subject).toEqual(BOB);
    });

    it("excludes multiple subject ids supplied via excludeSubjectIds (review R12)", () => {
        // Two users + one excluded → the picker must contain only one
        // remaining; with Alice + Bob both excluded the user tab still
        // renders but the picker is empty.
        renderDialog({ excludeSubjectIds: [ALICE.id, BOB.id] });
        // Open the picker on the active (user) tab.
        const trigger = document.querySelector('[role="combobox"]');
        if (trigger) fireEvent.click(trigger);
        // Neither Alice nor Bob appears as a pickable item.
        expect(screen.queryByText("Alice")).not.toBeInTheDocument();
        expect(screen.queryByText("Bob")).not.toBeInTheDocument();
    });

    it("handles cyclic action implications without hanging (review R13)", async () => {
        // A implies [B], B implies [A]. The closure visitor short-
        // circuits via the visited-set guard; the test pins that
        // termination contract so a refactor that drops the guard
        // would hang here rather than silently corrupting state.
        const cyclic: ShareActionOption[] = [
            { id: "A", label: "A", implies: ["B"] },
            { id: "B", label: "B", implies: ["A"] }
        ];
        const { onShare } = renderDialog({
            subjects: [BOB],
            initialSubjectId: BOB.id,
            actions: cyclic
        });
        const a = screen.getByLabelText(/^A/, { selector: "button" });
        const b = screen.getByLabelText(/^B/, { selector: "button" });
        fireEvent.click(a);
        await waitFor(() =>
            expect(a).toHaveAttribute("aria-checked", "true")
        );
        // The cycle expands both: checking A pulls B in.
        expect(b).toHaveAttribute("aria-checked", "true");
        // And the submit completes (no infinite loop).
        fireEvent.click(screen.getByRole("button", { name: /^Share$/ }));
        await waitFor(() => expect(onShare).toHaveBeenCalledTimes(1));
        expect(onShare.mock.calls[0][0].actions).toEqual(["A", "B"]);
    });

    it("resets effect + error + kind alongside actions on re-open (review R9)", async () => {
        const onShare = vi
            .fn()
            // First open: reject so we surface an error and set submitting=false.
            .mockRejectedValueOnce(new Error("first attempt failed"));
        const props = {
            open: true,
            onOpenChange: () => {},
            resourceLabel: "x",
            subjects: [BOB, TEAM_A],
            initialSubjectId: BOB.id,
            actions: ACTIONS,
            initialActionIds: ["ChannelsRead"],
            allowDeny: true,
            onShare
        };
        const { rerender } = render(<ShareDialog {...props} />);
        const user = userEvent.setup();
        // Mutate effect → Deny.
        await user.click(screen.getByLabelText(/^Deny/));
        // Submit so the rejected onShare populates `error`.
        fireEvent.click(screen.getByRole("button", { name: /^Share$/ }));
        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent("first attempt failed");
        // Switch to the User group tab so selectedKind != "user" anymore.
        await user.click(screen.getByRole("tab", { name: /User group/ }));
        // Close + re-open.
        rerender(<ShareDialog {...props} open={false} />);
        rerender(<ShareDialog {...props} open />);
        // After re-open: error gone, effect back to Allow, kind back
        // to "user" (so the User tab is data-state=active).
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        await waitFor(() =>
            expect(screen.getByLabelText(/^Allow/)).toHaveAttribute("aria-checked", "true")
        );
        const userTab = screen.getByRole("tab", { name: /^User$/ });
        await waitFor(() =>
            expect(userTab).toHaveAttribute("data-state", "active")
        );
    });
});


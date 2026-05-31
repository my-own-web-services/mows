/**
 * Public type surface for `ShareDialog`.
 *
 * Kept in its own module so consumers can `import type` the option
 * shapes without pulling in the React component (no bundler-side
 * tree-shake gotchas, no useless React import in type-only files).
 */

/** The nil UUID the engine uses as `subject_id` for `Public` and
 * `ServerMember` policies. Surfacing the literal nil to operators
 * is noisy, so the dialog renders these sentinels as the subject-
 * kind keyword instead. Exported so example/test code can share the
 * constant rather than re-typing the literal. */
export const SENTINEL_UUID = "00000000-0000-0000-0000-000000000000";

/** Discriminator for the four subject kinds the engine recognises
 * (mirrors `mows_auth_core::SubjectType`). The component lays
 * users / user-groups out as autocomplete pickers, and Public /
 * ServerMember as one-click toggles since their identity is fixed
 * sentinel — there's nothing to pick. */
export type ShareSubjectKind = "user" | "userGroup" | "public" | "serverMember";

/** One pickable subject. Caller-supplied: the dialog never queries
 * the consumer service itself, it just renders what it's given. */
export interface ShareSubjectOption {
    readonly kind: ShareSubjectKind;
    /** Stable id for this subject. For `user` / `userGroup` it's a
     * Uuid; for `public` / `serverMember` it's the sentinel
     * `"00000000-0000-0000-0000-000000000000"`. The dialog
     * surfaces this back to the caller verbatim via `onShare`. */
    readonly id: string;
    /** Display label shown in the picker + the selected pill. */
    readonly label: string;
    /** Optional secondary line (e.g. email, member count, "all
     * authenticated users"). */
    readonly description?: string;
}

/** One action the policy can grant or deny. Consumer-vocabulary —
 * the dialog never hard-codes action names (`ChannelsRead`,
 * `FilezFilesGet`, …); the caller passes the list that applies to
 * the resource being shared. */
export interface ShareActionOption {
    /** Wire-stable action key (e.g. `"ChannelsRead"`). Returned
     * verbatim via `onShare.actions`. */
    readonly id: string;
    /** Short label rendered next to the checkbox (e.g. `"Read"`). */
    readonly label: string;
    /** Optional explanation rendered below the label, e.g.
     * `"Grants read + sidebar visibility on this channel"`. */
    readonly description?: string;
    /** Other actions this one implies — checking this action auto-
     * checks the implied set so the caller doesn't ship a "read but
     * invisible in sidebar" policy by accident (the bug
     * realtime/chat's review B2 / SEC-4 caught). The dialog enforces
     * this at the UI layer; the policy that's submitted still
     * carries every checked id verbatim, the engine doesn't see
     * "implication" — it sees the materialised list. */
    readonly implies?: readonly string[];
}

/** Allow vs Deny. Defaults to Allow; callers opt into Deny via
 * `allowDeny`. The engine treats Deny as a precedence override
 * (POLICY_SEMANTICS.md §3 step 3) so this surface should stay
 * gated behind the consumer's deliberate UX choice. */
export type ShareEffect = "Allow" | "Deny";

/** Payload the caller receives on submit. The dialog never writes
 * to a database itself — it hands the shaped policy intent back
 * and the caller posts it through their own typed client. */
export interface ShareDialogSubmit {
    readonly subject: ShareSubjectOption;
    /** Materialised action ids (after implication expansion), in
     * the order they were defined in the `actions` prop. */
    readonly actions: readonly string[];
    readonly effect: ShareEffect;
}

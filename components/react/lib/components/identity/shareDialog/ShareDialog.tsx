import { Globe, Server, User as UserIcon, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@/components/ui/tabs";
import { SearchSelectPicker } from "@/components/input/searchSelectPicker/SearchSelectPicker";
import { cn } from "@/lib/utils";

import type {
    ShareActionOption,
    ShareDialogSubmit,
    ShareEffect,
    ShareSubjectKind,
    ShareSubjectOption
} from "./types";

/**
 * Generic, callback-driven share dialog.
 *
 * Phase 7 of the MOWS authorization initiative — replaces the
 * channel-only chat ShareDialog and serves filez / future consumers
 * from one component. The dialog never touches a consumer service:
 * the caller supplies the subject + action vocabulary and handles
 * the actual POST via `onShare`.
 *
 * Layout: subject tabs (User / UserGroup / Public / ServerMember,
 * each enabled only if the caller passes at least one subject of
 * that kind), action checkboxes with implication propagation, and
 * an optional Allow / Deny effect toggle gated behind `allowDeny`.
 *
 * Translations live with the consuming app, not here — every
 * user-facing string is a prop so the dialog stays i18n-neutral.
 */
export interface ShareDialogProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    /** Free-form description of the resource being shared, e.g.
     * `"channel #team-room"` or `"vacation-photos.jpg"`. Rendered
     * verbatim in the dialog title. */
    readonly resourceLabel: string;
    /** Optional secondary line under the title (e.g. resource id
     * shortened, or a "Public link" warning). */
    readonly resourceDescription?: ReactNode;
    /** All subjects the caller has access to. The dialog groups them
     * by `kind` and surfaces each non-empty kind as a tab. */
    readonly subjects: readonly ShareSubjectOption[];
    /** Actions the policy may grant on this resource. The caller
     * supplies the per-consumer vocabulary; the dialog never
     * hard-codes action names. */
    readonly actions: readonly ShareActionOption[];
    /** Subject ids to filter out of the picker (e.g. the acting
     * user's own id — a user can't share with themselves). */
    readonly excludeSubjectIds?: readonly string[];
    /** Subject pre-selected on open. Falls back to the first
     * non-excluded subject of the first non-empty kind. */
    readonly initialSubjectId?: string;
    /** Actions pre-checked on open. Implications are applied on
     * top of this set the first time the dialog opens. */
    readonly initialActionIds?: readonly string[];
    /** When true, show the Allow / Deny toggle. Off by default —
     * Deny is a precedence override the consumer should opt into
     * deliberately. */
    readonly allowDeny?: boolean;
    /** Called when the user confirms the share. The dialog awaits
     * the promise — throw an `Error` (or reject) to surface its
     * message inline and keep the dialog open so the user can
     * retry without re-entering the form. Resolve to close the
     * dialog and reset state. */
    readonly onShare: (input: ShareDialogSubmit) => Promise<void>;
    /** Strings the dialog renders. Defaults are English. Replace
     * via the consuming app's i18n layer if you need localisation;
     * the dialog itself never imports a translation table. */
    readonly strings?: Partial<ShareDialogStrings>;
}

export interface ShareDialogStrings {
    titlePrefix: string;
    /** Section heading above the subject tabs. */
    subjectHeading: string;
    subjectTabUser: string;
    subjectTabUserGroup: string;
    subjectTabPublic: string;
    subjectTabServerMember: string;
    subjectPickerPlaceholder: string;
    subjectPickerEmpty: string;
    subjectPickerTriggerEmpty: string;
    publicCardTitle: string;
    publicCardBody: string;
    serverMemberCardTitle: string;
    serverMemberCardBody: string;
    actionsHeading: string;
    effectHeading: string;
    effectAllow: string;
    effectDeny: string;
    errorPickSubject: string;
    errorPickAction: string;
    /** Shown when the caller passes `subjects={[]}`. The dialog
     * otherwise renders an empty tab bar with no picker — a silent
     * footgun for a caller who forgot to fetch the share targets.
     * Review R6 / QA-4. */
    noSubjectsAvailable: string;
    cancel: string;
    submit: string;
    submitting: string;
}

const DEFAULT_STRINGS: ShareDialogStrings = {
    titlePrefix: "Share",
    subjectHeading: "Share with",
    subjectTabUser: "User",
    subjectTabUserGroup: "User group",
    subjectTabPublic: "Anyone with the link",
    subjectTabServerMember: "Anyone on this server",
    subjectPickerPlaceholder: "Search…",
    subjectPickerEmpty: "No match.",
    subjectPickerTriggerEmpty: "Pick one…",
    publicCardTitle: "Public access",
    publicCardBody:
        "Anyone, signed in or not, gains the actions below. Use only when the resource is meant to be open to the internet.",
    serverMemberCardTitle: "Any signed-in user",
    serverMemberCardBody:
        "Every authenticated member of this server gains the actions below. Anonymous visitors do not.",
    actionsHeading: "Grant",
    effectHeading: "Effect",
    effectAllow: "Allow",
    effectDeny: "Deny (override)",
    errorPickSubject: "Pick someone to share with.",
    errorPickAction: "Grant at least one action.",
    noSubjectsAvailable:
        "Nothing to share with — no users, groups, or sentinels were supplied.",
    cancel: "Cancel",
    submit: "Share",
    submitting: "Sharing…"
};

const SUBJECT_TAB_ORDER: readonly ShareSubjectKind[] = [
    "user",
    "userGroup",
    "serverMember",
    "public"
];

const VALID_EFFECTS: ReadonlySet<ShareEffect> = new Set(["Allow", "Deny"]);

export const ShareDialog = ({
    open,
    onOpenChange,
    resourceLabel,
    resourceDescription,
    subjects,
    actions,
    excludeSubjectIds,
    initialSubjectId,
    initialActionIds,
    allowDeny = false,
    onShare,
    strings
}: ShareDialogProps) => {
    const s = { ...DEFAULT_STRINGS, ...strings };

    // Group subjects by kind, filtering out the excluded ids once
    // at the top so every downstream selector starts from the same
    // shortlist. Memoised on the inputs so a parent that re-creates
    // the arrays each render doesn't churn picker state.
    const grouped = useMemo(() => {
        const exclude = new Set(excludeSubjectIds ?? []);
        const out: Record<ShareSubjectKind, ShareSubjectOption[]> = {
            user: [],
            userGroup: [],
            public: [],
            serverMember: []
        };
        for (const subject of subjects) {
            if (exclude.has(subject.id)) continue;
            out[subject.kind].push(subject);
        }
        return out;
    }, [subjects, excludeSubjectIds]);

    const availableKinds = useMemo(
        () => SUBJECT_TAB_ORDER.filter((kind) => grouped[kind].length > 0),
        [grouped]
    );

    // Pre-compute the implication closure for every action: which
    // action ids does checking THIS action force on? Tested at
    // build time below; without memoisation the dialog walks the
    // graph for every checkbox click.
    const implicationsByAction = useMemo(
        () => buildImplicationClosure(actions),
        [actions]
    );

    const initialSubject = useMemo<ShareSubjectOption | undefined>(() => {
        if (initialSubjectId) {
            const hit = subjects.find((subject) => subject.id === initialSubjectId);
            if (hit) return hit;
        }
        for (const kind of availableKinds) {
            const first = grouped[kind][0];
            if (first) return first;
        }
        return undefined;
    }, [initialSubjectId, subjects, availableKinds, grouped]);

    const [selectedKind, setSelectedKind] = useState<ShareSubjectKind>(
        initialSubject?.kind ?? availableKinds[0] ?? "user"
    );
    const [selectedSubject, setSelectedSubject] = useState<
        ShareSubjectOption | undefined
    >(initialSubject);
    const [selectedActionIds, setSelectedActionIds] = useState<Set<string>>(
        () => applyImplications(new Set(initialActionIds ?? []), implicationsByAction)
    );
    const [effect, setEffect] = useState<ShareEffect>("Allow");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Monotonically increasing submission id. handleSubmit captures
    // its own id at await-start; the post-await close + reset only
    // fire when the captured id matches the current ref, so a
    // parent that closes + re-opens the dialog mid-await doesn't
    // get its second open's state wiped by the first await's
    // resolution. Review R1.
    const submissionIdRef = useRef(0);

    // Reset the form every time the dialog re-opens. Without this,
    // closing then re-opening would leak the prior selection — fine
    // for a settings dialog but surprising in a share flow where
    // each open is conceptually a new policy.
    //
    // Also bump the submission id so an in-flight onShare from the
    // previous open knows it's stale: when it finally resolves it
    // won't fire the post-await close or wipe state on the second
    // open (review R1).
    useEffect(() => {
        if (!open) return;
        submissionIdRef.current += 1;
        setSelectedKind(initialSubject?.kind ?? availableKinds[0] ?? "user");
        setSelectedSubject(initialSubject);
        setSelectedActionIds(
            applyImplications(new Set(initialActionIds ?? []), implicationsByAction)
        );
        setEffect("Allow");
        setError(null);
        setSubmitting(false);
    }, [open, initialSubject, initialActionIds, implicationsByAction, availableKinds]);

    const handleKindChange = (kind: string) => {
        const next = kind as ShareSubjectKind;
        setSelectedKind(next);
        if (next === "public" || next === "serverMember") {
            // The sentinel subjects don't need a picker — auto-
            // select the first (and only) entry of that kind so
            // submitting works without an extra interaction.
            //
            // Note: this assumes the caller supplies at most one
            // subject per sentinel kind (one Public, one
            // ServerMember). Two would auto-select whichever
            // appears first in `subjects` — see review R16. The
            // caller surface is "you supply subjects"; duplicates
            // are a caller bug and the dialog's grouped[next][0]
            // is deterministic on input order.
            setSelectedSubject(grouped[next][0]);
        } else {
            // Switching tabs deselects so the user explicitly
            // picks within the new kind. Auto-selecting the first
            // entry would silently change WHO the policy targets
            // — that's exactly the kind of subtle authorization
            // surprise we want to avoid.
            setSelectedSubject(undefined);
        }
    };

    const toggleAction = (actionId: string, checked: boolean) => {
        setSelectedActionIds((prev) => {
            const next = new Set(prev);
            if (checked) {
                next.add(actionId);
                // Auto-check implied actions so the consumer can't
                // ship a "Read but invisible in sidebar" policy by
                // accident (the realtime chat review B2 / SEC-4
                // bug pattern).
                for (const implied of implicationsByAction.get(actionId) ?? []) {
                    next.add(implied);
                }
            } else {
                next.delete(actionId);
                // Unchecking does NOT cascade — the user might
                // legitimately want the dependency without the
                // dependent, and a cascade would surprise them.
            }
            return next;
        });
    };

    const handleSubmit = async () => {
        if (!selectedSubject) {
            setError(s.errorPickSubject);
            return;
        }
        if (selectedActionIds.size === 0) {
            setError(s.errorPickAction);
            return;
        }
        // Bump + capture the submission id BEFORE the await so we
        // can tell post-resolution whether this submission is still
        // the active one. A parent that closes + re-opens during
        // the await bumps the ref via the effect below; the stale
        // resolution then skips the close + reset (review R1).
        submissionIdRef.current += 1;
        const submissionId = submissionIdRef.current;
        setSubmitting(true);
        setError(null);
        try {
            // Preserve the order from the `actions` prop so the
            // submitted policy carries action ids in a deterministic
            // sequence — Postgres ARRAY equality is order-sensitive
            // and tests are easier when ordering is stable.
            const orderedActions = actions
                .map((action) => action.id)
                .filter((id) => selectedActionIds.has(id));
            await onShare({
                subject: selectedSubject,
                actions: orderedActions,
                effect
            });
            if (submissionId === submissionIdRef.current) {
                onOpenChange(false);
            }
        } catch (e) {
            if (submissionId === submissionIdRef.current) {
                setError(e instanceof Error ? e.message : String(e));
            }
        } finally {
            if (submissionId === submissionIdRef.current) {
                setSubmitting(false);
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {s.titlePrefix} {resourceLabel}
                    </DialogTitle>
                    {/* Always render a Description so Radix's
                        aria-describedby contract holds — the title
                        alone doesn't tell screen readers what
                        actions the dialog will perform. Falls back
                        to the section heading text when the caller
                        doesn't supply something more specific. */}
                    <DialogDescription>
                        {resourceDescription ?? s.subjectHeading}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-2">
                    {availableKinds.length === 0 ? (
                        <p
                            className="text-muted-foreground py-6 text-center text-sm"
                            role="status"
                        >
                            {s.noSubjectsAvailable}
                        </p>
                    ) : (
                    <>
                    <section className="flex flex-col gap-2">
                        <h3 className="text-sm font-medium">{s.subjectHeading}</h3>
                        <Tabs value={selectedKind} onValueChange={handleKindChange}>
                            <TabsList className="flex flex-wrap">
                                {availableKinds.map((kind) => (
                                    <TabsTrigger key={kind} value={kind}>
                                        {SUBJECT_KIND_ICON[kind]}
                                        <span className="ml-1">
                                            {subjectKindLabel(kind, s)}
                                        </span>
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                            {availableKinds.map((kind) => (
                                <TabsContent
                                    key={kind}
                                    value={kind}
                                    className="mt-3 flex flex-col gap-2"
                                >
                                    <SubjectKindContent
                                        kind={kind}
                                        subjects={grouped[kind]}
                                        selected={selectedSubject}
                                        onSelect={setSelectedSubject}
                                        strings={s}
                                    />
                                </TabsContent>
                            ))}
                        </Tabs>
                    </section>

                    <section className="flex flex-col gap-2">
                        <h3 className="text-sm font-medium">{s.actionsHeading}</h3>
                        <ul className="flex flex-col gap-2">
                            {actions.map((action) => (
                                <li key={action.id}>
                                    <Label
                                        htmlFor={`share-action-${action.id}`}
                                        className="flex items-start gap-2 text-sm font-normal"
                                    >
                                        <Checkbox
                                            id={`share-action-${action.id}`}
                                            checked={selectedActionIds.has(action.id)}
                                            onCheckedChange={(checked) =>
                                                toggleAction(action.id, checked === true)
                                            }
                                        />
                                        <span className="flex flex-col gap-0.5">
                                            <span>{action.label}</span>
                                            {action.description !== undefined && (
                                                <span className="text-xs text-muted-foreground">
                                                    {action.description}
                                                </span>
                                            )}
                                        </span>
                                    </Label>
                                </li>
                            ))}
                        </ul>
                    </section>

                    {allowDeny && (
                        <section className="flex flex-col gap-2">
                            <h3 className="text-sm font-medium">{s.effectHeading}</h3>
                            <RadioGroup
                                value={effect}
                                // Runtime-narrow the radio value
                                // before it touches state. Today
                                // Radix constrains it to "Allow" /
                                // "Deny" via the RadioGroupItem
                                // children, but a future adapter
                                // or a hostile DOM mutation could
                                // push anything through; falling
                                // back to "Allow" keeps a
                                // misbehaving caller from sending
                                // a bogus effect to the engine
                                // (review R5).
                                onValueChange={(value) => {
                                    if (VALID_EFFECTS.has(value as ShareEffect)) {
                                        setEffect(value as ShareEffect);
                                    } else {
                                        setEffect("Allow");
                                    }
                                }}
                                className="flex gap-4"
                            >
                                <Label
                                    htmlFor="share-effect-allow"
                                    className="flex items-center gap-2 text-sm font-normal"
                                >
                                    <RadioGroupItem id="share-effect-allow" value="Allow" />
                                    {s.effectAllow}
                                </Label>
                                <Label
                                    htmlFor="share-effect-deny"
                                    className="flex items-center gap-2 text-sm font-normal"
                                >
                                    <RadioGroupItem id="share-effect-deny" value="Deny" />
                                    {s.effectDeny}
                                </Label>
                            </RadioGroup>
                        </section>
                    )}

                    {error !== null && (
                        <p className="text-sm text-destructive" role="alert">
                            {error}
                        </p>
                    )}
                    </>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={submitting}
                    >
                        {s.cancel}
                    </Button>
                    <Button
                        onClick={() => void handleSubmit()}
                        disabled={submitting || availableKinds.length === 0}
                    >
                        {submitting ? s.submitting : s.submit}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const SUBJECT_KIND_ICON: Record<ShareSubjectKind, ReactNode> = {
    user: <UserIcon className="size-3.5" />,
    userGroup: <Users className="size-3.5" />,
    public: <Globe className="size-3.5" />,
    serverMember: <Server className="size-3.5" />
};

const subjectKindLabel = (
    kind: ShareSubjectKind,
    s: ShareDialogStrings
): string => {
    switch (kind) {
        case "user":
            return s.subjectTabUser;
        case "userGroup":
            return s.subjectTabUserGroup;
        case "public":
            return s.subjectTabPublic;
        case "serverMember":
            return s.subjectTabServerMember;
        default: {
            // Compile-time guard: extending ShareSubjectKind
            // without adding a case here breaks the assignment
            // to `never`. Review R4 / TECH-2.
            const _exhaustive: never = kind;
            return _exhaustive;
        }
    }
};

interface SubjectKindContentProps {
    readonly kind: ShareSubjectKind;
    readonly subjects: readonly ShareSubjectOption[];
    readonly selected: ShareSubjectOption | undefined;
    readonly onSelect: (subject: ShareSubjectOption) => void;
    readonly strings: ShareDialogStrings;
}

const SubjectKindContent = ({
    kind,
    subjects,
    selected,
    onSelect,
    strings
}: SubjectKindContentProps) => {
    if (kind === "public") {
        return (
            <SentinelCard
                title={strings.publicCardTitle}
                body={strings.publicCardBody}
                selected={selected?.kind === "public"}
            />
        );
    }
    if (kind === "serverMember") {
        return (
            <SentinelCard
                title={strings.serverMemberCardTitle}
                body={strings.serverMemberCardBody}
                selected={selected?.kind === "serverMember"}
            />
        );
    }
    // user + userGroup: typed picker. Same component for both — only
    // the icon differs (already handled by the tab trigger).
    const selectedHere = selected?.kind === kind ? selected : undefined;
    return (
        <SearchSelectPicker
            items={subjects}
            selected={selectedHere}
            onSelect={onSelect}
            getId={(item) => item.id}
            matchesSearch={(item, search) => {
                const haystack = `${item.label} ${item.description ?? ""} ${item.id}`;
                return haystack.toLowerCase().includes(search.toLowerCase());
            }}
            renderItemContent={(item) => (
                <span className="flex flex-col gap-0.5">
                    <span>{item.label}</span>
                    {item.description !== undefined && (
                        <span className="text-xs text-muted-foreground">
                            {item.description}
                        </span>
                    )}
                </span>
            )}
            placeholder={strings.subjectPickerPlaceholder}
            emptyText={strings.subjectPickerEmpty}
            triggerTitle={subjectKindLabel(kind, strings)}
            emptyTrigger={<span>{strings.subjectPickerTriggerEmpty}</span>}
        />
    );
};

const SentinelCard = ({
    title,
    body,
    selected
}: {
    readonly title: string;
    readonly body: string;
    readonly selected: boolean;
}) => (
    <div
        className={cn(
            "rounded-md border p-3",
            selected ? "border-primary bg-primary/5" : "border-border bg-muted/30"
        )}
        // The Tab itself controls selection; this card is a static
        // explanation. No interactive ARIA — Tabs already wires
        // role="tabpanel" around it.
    >
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{body}</p>
    </div>
);

/** Build the transitive implication map: for each action id, the
 * set of action ids it forces on (directly or transitively). Cycles
 * are tolerated — once an id is in the closure, we don't recurse
 * back into it. Kept module-private so consumers can't mis-call it. */
const buildImplicationClosure = (
    actions: readonly ShareActionOption[]
): Map<string, Set<string>> => {
    const directs = new Map<string, readonly string[]>();
    for (const action of actions) {
        directs.set(action.id, action.implies ?? []);
    }
    const closure = new Map<string, Set<string>>();
    const visit = (id: string, acc: Set<string>) => {
        for (const implied of directs.get(id) ?? []) {
            if (acc.has(implied)) continue;
            acc.add(implied);
            visit(implied, acc);
        }
    };
    for (const action of actions) {
        const acc = new Set<string>();
        visit(action.id, acc);
        closure.set(action.id, acc);
    }
    return closure;
};

/** Expand a seed set of action ids by walking the implication
 * closure. Used to materialise `initialActionIds` so callers don't
 * have to enumerate the implied actions themselves. */
const applyImplications = (
    seed: Set<string>,
    closure: Map<string, Set<string>>
): Set<string> => {
    const out = new Set(seed);
    for (const id of seed) {
        for (const implied of closure.get(id) ?? []) {
            out.add(implied);
        }
    }
    return out;
};

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@my-own-web-services/react-components/components/ui/button";
import { Input } from "@my-own-web-services/react-components/components/ui/input";
import { Label } from "@my-own-web-services/react-components/components/ui/label";
import UpstreamTabs from "./components/UpstreamTabs";
import { api, type UpstreamStatus } from "./lib/api";

/// Persist the acting-user UUID across reloads so a developer
/// doesn't paste it back in every refresh. localStorage key is
/// namespaced to the app (the MowsProvider's storagePrefix is
/// for its own keys; this is app-level state).
const STORAGE_ACTING_USER = "authz-admin:acting-user";

export default function App() {
    const [upstreams, setUpstreams] = useState<UpstreamStatus[] | null>(null);
    const [upstreamsError, setUpstreamsError] = useState<string | null>(null);
    const [actingUser, setActingUser] = useState<string>(() =>
        localStorage.getItem(STORAGE_ACTING_USER) ?? ""
    );

    const refreshUpstreams = useCallback(async () => {
        setUpstreamsError(null);
        try {
            const res = await api.listUpstreams();
            setUpstreams(res.upstreams);
        } catch (e) {
            setUpstreamsError(e instanceof Error ? e.message : String(e));
        }
    }, []);

    // Stable ref to refreshUpstreams so the boot effect's deps
    // stay `[]` even if a future refactor adds a useCallback dep
    // here. Without the ref, adding any dep (e.g. `[actingUser]`)
    // would turn the boot fetch into a fetch-every-render loop.
    // (review-3 R6 / TECH-7)
    const refreshRef = useRef(refreshUpstreams);
    useEffect(() => {
        refreshRef.current = refreshUpstreams;
    }, [refreshUpstreams]);

    useEffect(() => {
        void refreshRef.current();
    }, []);

    useEffect(() => {
        if (actingUser) localStorage.setItem(STORAGE_ACTING_USER, actingUser);
        else localStorage.removeItem(STORAGE_ACTING_USER);
    }, [actingUser]);

    return (
        <div className="mx-auto flex h-full max-w-5xl flex-col gap-6 p-6">
            <header className="flex flex-col gap-1">
                <h1 className="text-xl font-semibold">authz admin</h1>
                <p className="text-sm text-muted-foreground">
                    Per-resource AuthReason across MOWS consumer services.
                    Reads <code>GET /api/upstreams</code> on load, then runs
                    one <code>/api/access_policies/explain</code> per
                    upstream tab via the BFF.
                </p>
            </header>

            <section className="rounded-md border border-border bg-card p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="flex flex-1 flex-col gap-1">
                        <Label htmlFor="acting-user">acting user UUID (dev)</Label>
                        <Input
                            id="acting-user"
                            value={actingUser}
                            onChange={(e) => setActingUser(e.target.value)}
                            placeholder="e.g. a11ce000-0000-0000-0000-000000000001"
                        />
                    </div>
                    <Button variant="outline" onClick={() => void refreshUpstreams()}>
                        Re-probe upstreams
                    </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                    Sent verbatim as <code>x-realtime-user-id</code> /{" "}
                    <code>x-filez-user-id</code>. Production replaces this
                    with a Bearer token (also passthrough'd by the BFF).
                </p>
            </section>

            {upstreamsError && (
                <p className="text-sm text-destructive">
                    upstreams probe failed: {upstreamsError}
                </p>
            )}

            {upstreams === null && !upstreamsError ? (
                <p className="text-sm text-muted-foreground">probing upstreams…</p>
            ) : upstreams !== null ? (
                <UpstreamTabs upstreams={upstreams} actingUser={actingUser} />
            ) : null}
        </div>
    );
}

import { type User, WebStorageStateStore } from "oidc-client-ts";
import type { ReactNode } from "react";
import { AuthProvider, withAuth } from "react-oidc-context";

import {
    MowsClientManagerBase,
    type MowsClientManagerProps,
    type MowsOidcConfig
} from "./MowsContext";

// Lazy chunk: isolates the OIDC auth wiring (`react-oidc-context` +
// `oidc-client-ts`) so it is only fetched when `<MowsProvider>` is rendered
// with an `oidc` config. Apps using the custom `authAdapter` (or no auth) never
// load it. See MowsContext.tsx.
//
// `withAuth` injects the `auth` (AuthContextProps) prop into the manager — the
// same wiring as before, just relocated into this on-demand module.
const MowsClientManager = withAuth(MowsClientManagerBase);

export interface OidcAuthGateProps {
    readonly oidc: MowsOidcConfig;
    /** All manager props except the `auth`/`children` injected here. */
    readonly managerProps: Omit<MowsClientManagerProps, "auth" | "children">;
    readonly onSigninCallback: (user: User | void) => void;
    readonly children: ReactNode;
}

export default function OidcAuthGate({
    oidc,
    managerProps,
    onSigninCallback,
    children
}: OidcAuthGateProps) {
    const oidcConfig = {
        userStore: new WebStorageStateStore({ store: window.localStorage }),
        authority: oidc.issuerUrl,
        client_id: oidc.clientId,
        redirect_uri: window.location.origin + (oidc.redirectPath ?? `/auth/callback`),
        response_type: `code`,
        scope: oidc.scope ?? `openid profile email`,
        post_logout_redirect_uri: oidc.postLogoutRedirectUri ?? window.location.origin,
        response_mode: `query` as const,
        automaticSilentRenew: true,
        onSigninCallback
    };

    return (
        <AuthProvider {...oidcConfig}>
            <MowsClientManager {...managerProps}>{children}</MowsClientManager>
        </AuthProvider>
    );
}

import {
    FilezContext,
    type FilezContextType
} from "@/lib/filezContext/FilezContext";
import { MowsProvider } from "@my-own-web-services/react-components/lib/mowsContext/MowsContext";
import {
    Api,
    type FilezUser,
    FilezUserType,
    type UserGroup,
    GroupJoinPolicy,
    GroupVisibility
} from "filez-client-typescript";
import filezEnglishTranslation from "@/lib/languages/en-US/default";
import { languages as filezLanguages } from "@/lib/languages";
import { themes as filezThemes } from "@/lib/themes";
import { filezExtraActions, filezExtraDefaultHotkeys } from "@/lib/filezActions";
import { type ReactNode } from "react";

/**
 * Strongly-typed shorthand for `Mock<typeof MockedClient.api[K]>` —
 * lets tests assert against `mock.calls` without losing argument types.
 */
export type MockedApi = Partial<Api<unknown>["api"]>;

export interface MockFilezContextOverrides {
    readonly api?: MockedApi;
    readonly ownFilezUser?: FilezUser | null;
}

type FilezApi = Api<unknown>["api"];

/**
 * Build a `FilezContextType` whose `filezClient.api` carries the supplied
 * mocks plus a base of "method not stubbed" rejecters for everything
 * else. Tests pass only the endpoints they exercise. The Proxy's target
 * is typed as `FilezApi` (instead of `unknown`) so TS catches stubs that
 * name a method which no longer exists in the generated client.
 */
export const buildMockFilezContext = (
    overrides: MockFilezContextOverrides = {}
): FilezContextType => {
    const proxyApi = new Proxy({} as FilezApi, {
        get: (_target, name: string) => {
            const stub = (overrides.api ?? {})[name as keyof MockedApi];
            if (stub) return stub;
            return () =>
                Promise.reject(new Error(`unmocked API call: ${name}`));
        }
    });

    return {
        filezClient: { api: proxyApi } as Api<unknown>,
        clientConfig: {
            oidcIssuerUrl: `https://example.invalid`,
            oidcClientId: `test`,
            serverUrl: `https://example.invalid`
        },
        clientLoading: false,
        clientAuthenticated: true,
        ownFilezUser: overrides.ownFilezUser ?? null
    };
};

/**
 * Thin test wrapper: real MowsProvider (filez translations + theme)
 * around an injected FilezContext. Keeps the test surface stable when
 * FilezProvider's bootstrapping shape changes.
 */
export const MockFilezProvider = (props: {
    children: ReactNode;
    overrides?: MockFilezContextOverrides;
}) => {
    const value = buildMockFilezContext(props.overrides);
    return (
        <MowsProvider
            storagePrefix={`filez-test`}
            themes={filezThemes}
            languages={filezLanguages}
            initialTranslation={filezEnglishTranslation}
            extraActions={filezExtraActions}
            extraDefaultHotkeys={filezExtraDefaultHotkeys}
        >
            <FilezContext.Provider value={value}>{props.children}</FilezContext.Provider>
        </MowsProvider>
    );
};

export const buildUserGroup = (overrides: Partial<UserGroup> = {}): UserGroup => ({
    id: `00000000-0000-0000-0000-000000000aaa`,
    owner_id: `00000000-0000-0000-0000-000000000ddd`,
    name: `Engineering`,
    description: null,
    visibility: GroupVisibility.Private,
    join_policy: GroupJoinPolicy.InviteOnly,
    materialize_uga: false,
    created_time: `2026-01-01T00:00:00Z`,
    modified_time: `2026-01-01T00:00:00Z`,
    ...overrides
});

export const buildUser = (overrides: Partial<FilezUser> = {}): FilezUser => ({
    id: `00000000-0000-0000-0000-000000000ddd`,
    display_name: `Test User`,
    deleted: false,
    created_time: `2026-01-01T00:00:00Z`,
    modified_time: `2026-01-01T00:00:00Z`,
    profile_picture: null,
    pre_identifier_email: null,
    external_user_id: null,
    idp_id: `00000000-0000-0000-0000-000000000bbb`,
    user_type: FilezUserType.Regular,
    created_by: null,
    ...overrides
});

export const apiOk = <T,>(data: T) =>
    ({
        data: {
            status: { Success: {} },
            message: ``,
            data
        }
    }) as unknown as { data: { data: T } };

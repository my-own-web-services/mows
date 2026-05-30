import { useCallback, useSyncExternalStore } from "react";
import {
    type AppSettings,
    type AppSettingsContextValue,
    type AppSettingsSchema,
    type SchemaValues,
    matchesFieldType
} from "./appSettings";
import { useMows } from "./MowsContext";

/**
 * Read + write a single typed setting from the unified blob.
 *
 * Common form (auto-fetches context):
 *
 *   const [view, setView] = useAppSetting(filezSettings, "defaultView");
 *
 * Explicit form for tests / advanced usage (no MowsProvider needed):
 *
 *   const [view, setView] = useAppSetting(filezSettings, "defaultView", ctx);
 *
 * Falls back to the schema default when nothing is stored or when the
 * stored value's runtime type doesn't match the declared one
 * (defensive against blob corruption or schema drift).
 *
 * Throws if the schema's `appKey` isn't the one currently registered
 * on the surrounding `<MowsProvider appSettings={…} />` — a silent
 * write under the wrong key is almost certainly a wiring bug.
 */
export const useAppSetting = <S extends AppSettingsSchema, K extends keyof S>(
    schema: AppSettings<S>,
    key: K,
    explicitContext?: AppSettingsContextValue
): readonly [SchemaValues<S>[K], (value: SchemaValues<S>[K]) => void] => {
    // The `explicitContext` branch never calls `useMows()`, so we
    // always call it (rules of hooks). When the explicit context is
    // passed we ignore the auto-fetched one.
    const fromMows = useMowsContextSafe();
    const appSettingsContext = explicitContext ?? fromMows;

    if (!appSettingsContext) {
        throw new Error(
            `useAppSetting: no AppSettingsContextValue available. ` +
                `Either render under <MowsProvider> or pass the context explicitly.`
        );
    }

    if (appSettingsContext.registered?.appKey !== schema.appKey) {
        throw new Error(
            `useAppSetting: schema with appKey "${schema.appKey}" was not registered on MowsProvider. ` +
                `Pass it via <MowsProvider appSettings={…} />.`
        );
    }
    const field = schema.schema[key];
    if (!field) {
        throw new Error(
            `useAppSetting: unknown settingId "${String(key)}" — not declared in the schema for "${schema.appKey}"`
        );
    }

    const settingId = String(key);

    const value = useSyncExternalStore(
        useCallback(
            (listener) => appSettingsContext.subscribe(settingId, listener),
            [appSettingsContext, settingId]
        ),
        useCallback(() => {
            const stored = appSettingsContext.getValue(settingId);
            return matchesFieldType(stored, field)
                ? (stored as SchemaValues<S>[K])
                : (field.default as SchemaValues<S>[K]);
        }, [appSettingsContext, field, settingId])
    );

    const setValue = useCallback(
        (next: SchemaValues<S>[K]) => {
            appSettingsContext.setValue(settingId, next);
        },
        [appSettingsContext, settingId]
    );

    return [value, setValue] as const;
};

/**
 * Variant of `useMows().appSettings` that swallows ONLY the
 * "useMows must be used within a MowsProvider" error so tests can
 * supply an explicit context. Any other error — a real provider bug,
 * a corrupt context, etc. — is re-thrown so it surfaces in the
 * console instead of being silently downgraded.
 */
const MISSING_PROVIDER_MARKER = `useMows must be used within a MowsProvider`;

const useMowsContextSafe = (): AppSettingsContextValue | undefined => {
    try {
        return useMows().appSettings;
    } catch (error) {
        if (error instanceof Error && error.message === MISSING_PROVIDER_MARKER) {
            return undefined;
        }
        throw error;
    }
};

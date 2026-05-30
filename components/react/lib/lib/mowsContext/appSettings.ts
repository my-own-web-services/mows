import { type ReactNode } from "react";
import { type Translation } from "../languages";
import { type SettingsManager } from "./SettingsManager";

/**
 * Consumer-app settings registry.
 *
 * Each app calls `defineAppSettings({ appKey, schema })` once at
 * module load and passes the returned object to `<MowsProvider
 * appSettings={…} />`. The schema is a record of typed field
 * descriptors that drive both:
 *
 *  - persistence: values are stored under `app.<appKey>.<settingId>`
 *    inside the unified settings blob; the `SettingsPanel` renders
 *    one section per app with rows for each field;
 *  - typed access: the same schema is consumed by `useAppSetting`
 *    (returns the value and a setter, both fully inferred from the
 *    schema) so consumer code never deals with `unknown` casts.
 *
 * Field types are intentionally a small set covering the cases the
 * built-in SettingsPanel knows how to render. Apps that need a custom
 * UI for a specific row can supply a `render` override on the field
 * (the storage / typed-hook plumbing is identical).
 */

export type AppSettingFieldType =
    | `boolean`
    | `select`
    | `number`
    | `slider`
    | `string`
    | `color`;

/** Translation-aware label/description: either a literal string or a
 * resolver function. Resolved by `<SettingsPanel>` and the doc page. */
export type LocalisedText = string | ((t: Translation) => string);

export interface AppSettingFieldBase<T> {
    readonly type: AppSettingFieldType;
    readonly default: T;
    readonly label: LocalisedText;
    readonly description?: LocalisedText;
    /** Optional grouping inside `<SettingsPanel>`. Fields without a
     * group land in an "Other" bucket (translated). */
    readonly group?: LocalisedText;
    /** Escape hatch: render the row body yourself. Receives the
     * current value + setter, so all storage plumbing stays
     * free. Returning `undefined` falls back to the built-in
     * renderer for `type`. */
    readonly render?: (props: {
        value: T;
        setValue: (next: T) => void;
        t: Translation;
    }) => ReactNode;
}

export interface BooleanField extends AppSettingFieldBase<boolean> {
    readonly type: `boolean`;
}

export interface SelectField<V extends string = string>
    extends AppSettingFieldBase<V> {
    readonly type: `select`;
    readonly options: ReadonlyArray<{ readonly value: V; readonly label: LocalisedText }>;
}

export interface NumberField extends AppSettingFieldBase<number> {
    readonly type: `number`;
    readonly min?: number;
    readonly max?: number;
    readonly step?: number;
}

export interface SliderField extends AppSettingFieldBase<number> {
    readonly type: `slider`;
    readonly min: number;
    readonly max: number;
    readonly step?: number;
}

export interface StringField extends AppSettingFieldBase<string> {
    readonly type: `string`;
    readonly placeholder?: LocalisedText;
}

export interface ColorField extends AppSettingFieldBase<string> {
    readonly type: `color`;
}

export type AppSettingField =
    | BooleanField
    | SelectField
    | NumberField
    | SliderField
    | StringField
    | ColorField;

/** Type-level: derive the value type a field stores. */
export type InferFieldValue<F> =
    F extends BooleanField
        ? boolean
        : F extends SelectField<infer V>
        ? V
        : F extends NumberField | SliderField
        ? number
        : F extends StringField | ColorField
        ? string
        : never;

export type AppSettingsSchema = Readonly<Record<string, AppSettingField>>;

export type SchemaValues<S extends AppSettingsSchema> = {
    readonly [K in keyof S]: InferFieldValue<S[K]>;
};

export interface AppSettings<S extends AppSettingsSchema> {
    readonly appKey: string;
    readonly schema: S;
}

/** Erased type used for storage / panel iteration where the concrete
 * schema is irrelevant. The typed surface lives in the `useAppSetting`
 * hook returned by `defineAppSettings`. */
export type AnyAppSettings = AppSettings<AppSettingsSchema>;

/**
 * Define an app's settings schema. Returned object is what you pass
 * to `<MowsProvider appSettings={…} />`; the matching typed hook is
 * available via `useAppSetting(schema, "fieldId")` or — for tidier
 * per-app call sites — `createAppSettingsHooks(schema)`.
 */
export const defineAppSettings = <S extends AppSettingsSchema>(opts: {
    readonly appKey: string;
    readonly schema: S;
}): AppSettings<S> => {
    if (!opts.appKey) {
        throw new Error(`defineAppSettings: appKey must be a non-empty string`);
    }
    return { appKey: opts.appKey, schema: opts.schema };
};

/**
 * Resolve a `LocalisedText` against the current translation. Lib
 * helper so callers don't repeat the typeof guard.
 */
export const resolveLocalisedText = (text: LocalisedText, t: Translation): string =>
    typeof text === `function` ? text(t) : text;

/**
 * What `MowsContext.appSettings` looks like to consumers — the
 * registered schema (or null when the app didn't register any) plus
 * raw read/write helpers. Typed hooks (`useAppSetting`) wrap these
 * behind the schema's inferred types.
 */
export interface AppSettingsContextValue {
    readonly registered: AnyAppSettings | null;
    readonly getValue: <T = unknown>(settingId: string) => T | undefined;
    readonly setValue: (settingId: string, value: unknown) => void;
    readonly subscribe: (settingId: string, listener: () => void) => () => void;
}

export const createAppSettingsContextValue = (
    settingsManager: SettingsManager,
    registered: AnyAppSettings | null
): AppSettingsContextValue => {
    if (registered === null) {
        // No schema registered: reads return undefined (callers fall
        // through to the schema default — but there IS no schema, so
        // callers should never reach here in production), writes
        // throw. The two-faced behaviour is intentional: we want
        // unregistered apps to fail loudly on writes (catches the
        // "forgot to pass appSettings" wiring bug) while still
        // allowing SettingsPanel to render its core sections in apps
        // that genuinely have no per-app settings.
        return {
            registered: null,
            getValue: () => undefined,
            setValue: (settingId) => {
                throw new Error(
                    `useAppSetting/appSettings: tried to write "${settingId}" but no app schema was ` +
                        `registered on <MowsProvider appSettings={…} />.`
                );
            },
            subscribe: () => () => undefined
        };
    }
    const appKey = registered.appKey;
    return {
        registered,
        getValue: <T,>(settingId: string) =>
            settingsManager.getApp<T>(appKey, settingId),
        setValue: (settingId, value) => {
            settingsManager.setApp(appKey, settingId, value);
        },
        subscribe: (settingId, listener) =>
            settingsManager.subscribe(`app.${appKey}.${settingId}`, listener)
    };
};

/**
 * Runtime type guard so corrupted / out-of-spec storage values fall
 * back to the schema default instead of leaking the wrong type into
 * consumer code.
 */
export const matchesFieldType = (value: unknown, field: AppSettingField): boolean => {
    switch (field.type) {
        case `boolean`:
            return typeof value === `boolean`;
        case `number`:
        case `slider`:
            return typeof value === `number` && Number.isFinite(value);
        case `string`:
        case `color`:
            return typeof value === `string`;
        case `select`:
            return (
                typeof value === `string` &&
                field.options.some((opt) => opt.value === value)
            );
    }
};

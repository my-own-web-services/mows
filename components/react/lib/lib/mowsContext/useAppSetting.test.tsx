import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
    type AppSettingsContextValue,
    createAppSettingsContextValue,
    defineAppSettings
} from "./appSettings";
import { SettingsManager, type SettingsStorageAdapter } from "./SettingsManager";
import { useAppSetting } from "./useAppSetting";

const inMemoryStorage = (): SettingsStorageAdapter => {
    const data = new Map<string, string>();
    return {
        getItem: (k) => data.get(k) ?? null,
        setItem: (k, v) => {
            data.set(k, v);
        },
        removeItem: (k) => {
            data.delete(k);
        }
    };
};

const buildContext = (): {
    appSettings: AppSettingsContextValue;
    manager: SettingsManager;
} => {
    const manager = new SettingsManager({
        storagePrefix: `test`,
        storage: inMemoryStorage()
    });
    const schema = defineAppSettings({
        appKey: `filez`,
        schema: {
            showHidden: {
                type: `boolean` as const,
                default: false,
                label: `Show hidden`
            },
            view: {
                type: `select` as const,
                options: [
                    { value: `grid`, label: `Grid` },
                    { value: `list`, label: `List` }
                ],
                default: `grid` as const,
                label: `View`
            }
        }
    });
    return {
        manager,
        appSettings: createAppSettingsContextValue(manager, schema)
    };
};

describe(`useAppSetting (React-level)`, () => {
    it(`renders the schema default when nothing is stored, and writes through the manager on setValue`, async () => {
        const user = userEvent.setup();
        const { appSettings, manager } = buildContext();
        const schema = defineAppSettings({
            appKey: `filez`,
            schema: {
                showHidden: {
                    type: `boolean` as const,
                    default: false,
                    label: `Show hidden`
                }
            }
        });

        const Probe = () => {
            const [value, setValue] = useAppSetting(schema, `showHidden`, appSettings);
            return (
                <button type={`button`} onClick={() => setValue(!value)}>
                    {value ? `on` : `off`}
                </button>
            );
        };

        render(<Probe />);
        const button = screen.getByRole(`button`);
        expect(button).toHaveTextContent(`off`);

        await user.click(button);
        expect(button).toHaveTextContent(`on`);
        expect(manager.getApp(`filez`, `showHidden`)).toBe(true);
    });

    it(`falls back to the schema default when the stored value's runtime type doesn't match`, () => {
        const { appSettings, manager } = buildContext();
        // Plant a garbage value at the field's path — emulates a
        // corrupted blob or a schema-version drift.
        manager.setApp(`filez`, `view`, 42 as unknown as `grid`);
        const schema = defineAppSettings({
            appKey: `filez`,
            schema: {
                view: {
                    type: `select` as const,
                    options: [
                        { value: `grid`, label: `Grid` },
                        { value: `list`, label: `List` }
                    ],
                    default: `grid` as const,
                    label: `View`
                }
            }
        });

        const Probe = () => {
            const [value] = useAppSetting(schema, `view`, appSettings);
            return <span>{value}</span>;
        };

        render(<Probe />);
        expect(screen.getByText(`grid`)).toBeInTheDocument();
    });

    it(`re-renders when an external write to the same path lands in the manager`, () => {
        const { appSettings, manager } = buildContext();
        const schema = defineAppSettings({
            appKey: `filez`,
            schema: {
                showHidden: {
                    type: `boolean` as const,
                    default: false,
                    label: `Show hidden`
                }
            }
        });

        const Probe = () => {
            const [value] = useAppSetting(schema, `showHidden`, appSettings);
            return <span data-testid={`probe`}>{String(value)}</span>;
        };

        render(<Probe />);
        expect(screen.getByTestId(`probe`)).toHaveTextContent(`false`);

        // External code mutates the manager — the subscription on
        // `app.filez.showHidden` should re-render the probe. Wrapped
        // in `act` so React batches the useSyncExternalStore update.
        act(() => {
            manager.setApp(`filez`, `showHidden`, true);
        });
        expect(screen.getByTestId(`probe`)).toHaveTextContent(`true`);
    });

    it(`throws on unknown schema key (developer typo)`, () => {
        const { appSettings } = buildContext();
        const schema = defineAppSettings({
            appKey: `filez`,
            schema: {
                showHidden: {
                    type: `boolean` as const,
                    default: false,
                    label: `Show hidden`
                }
            }
        });

        const Probe = () => {
            // Intentionally cast to bypass TS for the runtime check.
            useAppSetting(schema, `nope` as unknown as `showHidden`, appSettings);
            return null;
        };

        expect(() => render(<Probe />)).toThrow(/unknown settingId/);
    });

    it(`throws when called against an explicit context bound to a different appKey`, () => {
        const { manager } = buildContext();
        const wrongCtx = createAppSettingsContextValue(
            manager,
            defineAppSettings({
                appKey: `other`,
                schema: {
                    flag: { type: `boolean` as const, default: false, label: `x` }
                }
            })
        );
        const schema = defineAppSettings({
            appKey: `filez`,
            schema: {
                showHidden: {
                    type: `boolean` as const,
                    default: false,
                    label: `Show hidden`
                }
            }
        });

        const Probe = () => {
            useAppSetting(schema, `showHidden`, wrongCtx);
            return null;
        };

        expect(() => render(<Probe />)).toThrow(/was not registered/);
    });
});

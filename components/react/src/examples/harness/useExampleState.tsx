import * as React from "react";

type ExampleStateSetter = (state: unknown) => void;

const ExampleStateContext = React.createContext<ExampleStateSetter | null>(null);

interface ExampleStateProviderProps {
    readonly onChange: ExampleStateSetter;
    readonly children: React.ReactNode;
}

export const ExampleStateProvider = ({ onChange, children }: ExampleStateProviderProps) => (
    <ExampleStateContext.Provider value={onChange}>{children}</ExampleStateContext.Provider>
);

// Monotonic counter used as a "definitely-new" cache key when JSON.stringify
// throws (circular state, BigInt, etc.). Reads as an explicit "force-fresh"
// sentinel, unlike Math.random() which looks like an entropy source.
let unserializableStateCounter = 0;

/**
 * Publish the current state of an example component to the surrounding
 * `<ExampleCard>`. The harness renders the latest value in the State tab.
 *
 * Examples that don't call this hook simply don't publish state — the
 * State tab shows "no state reported".
 */
export const useExampleState = (state: unknown): void => {
    const onChange = React.useContext(ExampleStateContext);
    const serialized = React.useMemo(() => {
        try {
            return JSON.stringify(state);
        } catch {
            // Serialization fell over (circular ref, BigInt, etc.). Use a
            // bumped counter so every render is considered "changed"; the
            // display path uses serializeState() which handles these cases.
            unserializableStateCounter += 1;
            return `__unserializable_${unserializableStateCounter}`;
        }
    }, [state]);

    React.useEffect(() => {
        onChange?.(state);
        // intentionally exclude `state` from deps — we key on its
        // serialized form to avoid identity churn from inline object
        // literals.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serialized, onChange]);
};

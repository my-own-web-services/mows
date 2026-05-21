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
            // serialize key only — the real serialization for display
            // happens later via serializeState(). A failure here just
            // forces every render to be considered "changed", which is
            // acceptable; the display path will produce a stable result.
            return Math.random().toString();
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

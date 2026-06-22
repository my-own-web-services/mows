import Duration from "../../../lib/components/dateTime/duration/Duration";
import type { ExampleModule } from "../harness/types";

const SAMPLE = 5 * 60 * 60 + 23 * 60 + 47; // 5 h 23 min 47 s

/**
 * The same input rendered with different `minUnit` floors. The
 * component never shows a `0 [unit]` part — sub-precision values
 * collapse to `<1 [unit]`.
 */
const Example = () => {
    return (
        <div className={`flex w-full flex-col items-stretch gap-3 p-6`}>
            <Row hint={`minUnit="s" — full precision`}>
                <Duration seconds={SAMPLE} variant={`long`} minUnit={`s`} />
            </Row>
            <Row hint={`minUnit="min" — drop seconds`}>
                <Duration seconds={SAMPLE} variant={`long`} minUnit={`min`} />
            </Row>
            <Row hint={`minUnit="h" — drop minutes too`}>
                <Duration seconds={SAMPLE} variant={`long`} minUnit={`h`} />
            </Row>
            <Row hint={`30 s @ minUnit="min" — sub-precision`}>
                <Duration seconds={30} variant={`long`} minUnit={`min`} />
            </Row>
            <Row hint={`seconds=0 — never "0 s"`}>
                <Duration seconds={0} variant={`long`} />
            </Row>
        </div>
    );
};

const Row = ({ hint, children }: { readonly hint: string; readonly children: React.ReactNode }) => (
    <div className={`flex items-center justify-between gap-4 rounded-md border bg-card px-3 py-2`}>
        <span className={`text-xs text-muted-foreground`}>{hint}</span>
        <span className={`tabular-nums`}>{children}</span>
    </div>
);

const module: ExampleModule = {
    strings: (t) => t.examples.duration.granularity,
    Example
};

export default module;

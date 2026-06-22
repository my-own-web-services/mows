import Duration from "../../../lib/components/dateTime/duration/Duration";
import type { ExampleModule } from "../harness/types";

/**
 * Same component, several magnitudes — sub-minute, minutes, hours,
 * multi-day. `splitDuration` anchors to the largest non-zero unit and
 * always surfaces the next sub-unit so the reader sees one level of
 * sub-precision.
 */
const Example = () => {
    return (
        <div className={`flex w-full flex-col items-stretch gap-3 p-6`}>
            <Row hint={`45 seconds`}>
                <Duration seconds={45} variant={`long`} />
            </Row>
            <Row hint={`5 min 30 s`}>
                <Duration seconds={5 * 60 + 30} variant={`long`} />
            </Row>
            <Row hint={`5 min sharp — no trailing 0 s`}>
                <Duration seconds={5 * 60} variant={`long`} />
            </Row>
            <Row hint={`1 h 10 min`}>
                <Duration seconds={60 * 60 + 10 * 60} variant={`long`} />
            </Row>
            <Row hint={`1 h sharp — no trailing 0 min`}>
                <Duration seconds={60 * 60} variant={`long`} />
            </Row>
            <Row hint={`2 d 4 h`}>
                <Duration seconds={2 * 86400 + 4 * 3600} variant={`long`} />
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
    strings: (t) => t.examples.duration.ranges,
    Example
};

export default module;

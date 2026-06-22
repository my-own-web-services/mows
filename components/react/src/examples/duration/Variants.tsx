import Duration from "../../../lib/components/dateTime/duration/Duration";
import type { ExampleModule } from "../harness/types";

const SAMPLE_SECONDS = 60 * 60 + 10 * 60;

/**
 * Force each variant explicitly. Useful inside fixed chips or table
 * cells where the responsive measurement would be wasted work.
 */
const Example = () => {
    return (
        <div className={`flex w-full flex-col items-stretch gap-3 p-6`}>
            <Row label={`long`}>
                <Duration seconds={SAMPLE_SECONDS} variant={`long`} />
            </Row>
            <Row label={`medium`}>
                <Duration seconds={SAMPLE_SECONDS} variant={`medium`} />
            </Row>
            <Row label={`short`}>
                <Duration seconds={SAMPLE_SECONDS} variant={`short`} />
            </Row>
        </div>
    );
};

const Row = ({ label, children }: { readonly label: string; readonly children: React.ReactNode }) => (
    <div className={`flex items-center gap-3`}>
        <span className={`w-20 text-xs text-muted-foreground`}>{label}</span>
        <span className={`rounded-md border bg-card px-2 py-1 tabular-nums`}>
            {children}
        </span>
    </div>
);

const module: ExampleModule = {
    strings: (t) => t.examples.duration.variants,
    Example
};

export default module;

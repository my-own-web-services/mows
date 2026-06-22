import Duration from "../../../lib/components/dateTime/duration/Duration";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    return (
        <div className={`flex w-full items-center justify-center p-8`}>
            <div className={`w-40 rounded-md border px-3 py-2 text-center`}>
                <Duration seconds={60 * 60 + 10 * 60} />
            </div>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.duration.default,
    Example
};

export default module;

import Avatar from "../../../lib/components/identity/avatar/Avatar";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({});

    return (
        <div className={`flex items-center gap-3`}>
            <Avatar displayName={`Ada Lovelace`} />
            <Avatar displayName={`Bob`} />
            <Avatar displayName={`Carol`} />
            <Avatar />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.avatar.default,
    Example
};

export default module;

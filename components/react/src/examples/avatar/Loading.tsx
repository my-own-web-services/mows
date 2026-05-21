import Avatar from "../../../lib/components/identity/avatar/Avatar";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ displayName: undefined });

    return (
        <div className={`flex items-center gap-3`}>
            <Avatar />
            <span className={`text-sm text-muted-foreground`}>
                Without a displayName the avatar renders a skeleton placeholder
                — perfect for the period between mount and auth resolving.
            </span>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.avatar.loading,
    Example
};

export default module;

import IconBadge from "../../../lib/components/display/iconBadge/IconBadge";
import { Cloud, File } from "lucide-react";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    return (
        <div className={`flex w-full items-center justify-center p-8`}>
            <IconBadge
                size={48}
                icon={<File className={`h-12 w-12`} />}
                badge={<Cloud className={`h-5 w-5`} />}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.iconBadge.default,
    Example
};

export default module;

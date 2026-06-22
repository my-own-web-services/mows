import IconBadge, {
    type IconBadgePosition
} from "../../../lib/components/display/iconBadge/IconBadge";
import { Check, Folder } from "lucide-react";
import type { ExampleModule } from "../harness/types";

const ALL_POSITIONS: ReadonlyArray<IconBadgePosition> = [
    `top-left`,
    `top`,
    `top-right`,
    `left`,
    `right`,
    `bottom-left`,
    `bottom`,
    `bottom-right`
];

const Example = () => {
    return (
        <div className={`grid w-full grid-cols-4 place-items-center gap-10 p-8`}>
            {ALL_POSITIONS.map((position) => (
                <div key={position} className={`flex flex-col items-center gap-2`}>
                    <IconBadge
                        size={48}
                        badgePosition={position}
                        icon={<Folder className={`h-12 w-12`} />}
                        badge={<Check className={`h-5 w-5`} />}
                    />
                    <code className={`text-xs text-muted-foreground`}>{position}</code>
                </div>
            ))}
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.iconBadge.positions,
    Example
};

export default module;

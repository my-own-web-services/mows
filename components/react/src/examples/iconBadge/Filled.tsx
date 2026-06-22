import IconBadge from "../../../lib/components/display/iconBadge/IconBadge";
import { Check, User, X } from "lucide-react";
import type { ExampleModule } from "../harness/types";

/**
 * Opt-in filled badge — pass a `bg-*` class via `badgeClassName` to
 * turn the bare default into a coloured status indicator. The mask
 * still punches the primary icon out behind the fill, so the badge
 * edge stays clean against any surface.
 */
const Example = () => {
    return (
        <div className={`flex w-full flex-wrap items-center justify-center gap-8 p-6`}>
            <IconBadge
                size={56}
                icon={<User className={`h-14 w-14`} />}
                badge={<Check className={`h-6 w-6 text-white`} />}
                badgeClassName={`bg-emerald-500`}
            />
            <IconBadge
                size={56}
                icon={<User className={`h-14 w-14`} />}
                badge={<X className={`h-6 w-6 text-white`} />}
                badgeClassName={`bg-destructive`}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.iconBadge.filled,
    Example
};

export default module;

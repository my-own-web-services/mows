import IconBadge from "../../../lib/components/display/iconBadge/IconBadge";
import { Cloud, File, Folder, Lock } from "lucide-react";
import type { ExampleModule } from "../harness/types";

/**
 * The mask honesty test. None of the backdrops below are a flat
 * colour: a checkerboard alternates light + dark cells, a multi-stop
 * gradient sweeps through hues, and a radial-dot pattern paints a
 * field of dots. Whatever pixels happen to sit behind the badge
 * cutout show through verbatim — proof the badge isn't faking
 * transparency with a parent-matching fill colour.
 */

const checkerboardStyle = {
    backgroundImage: `
        linear-gradient(45deg, rgba(0,0,0,0.18) 25%, transparent 25%),
        linear-gradient(-45deg, rgba(0,0,0,0.18) 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, rgba(0,0,0,0.18) 75%),
        linear-gradient(-45deg, transparent 75%, rgba(0,0,0,0.18) 75%)
    `,
    backgroundSize: `16px 16px`,
    backgroundPosition: `0 0, 0 8px, 8px -8px, -8px 0px`,
    backgroundColor: `#fef3c7`,
    // Dark icon color set once here (inherited via currentColor by the Lucide
    // icons below) instead of a banned `text-stone-*` class — this demo surface
    // is a fixed light tile, so a theme-following token would vanish on it.
    color: `#1c1917`
};

const gradientStyle = {
    backgroundImage: `linear-gradient(135deg,#0ea5e9 0%,#22c55e 30%,#f97316 65%,#ef4444 100%)`
};

const dotsStyle = {
    backgroundImage: `radial-gradient(circle at center, rgba(255,255,255,0.85) 2.5px, transparent 3px)`,
    backgroundSize: `12px 12px`,
    backgroundColor: `#7c3aed`
};

const Example = () => {
    return (
        <div className={`flex w-full flex-wrap items-center justify-center gap-6 p-6`}>
            <div
                className={`flex items-center justify-center rounded-md p-6`}
                style={checkerboardStyle}
            >
                <IconBadge
                    size={56}
                    icon={<Folder className={`h-14 w-14`} />}
                    badge={<Lock className={`h-6 w-6`} />}
                />
            </div>
            <div
                className={`flex items-center justify-center rounded-md p-6 text-white`}
                style={gradientStyle}
            >
                <IconBadge
                    size={56}
                    icon={<File className={`h-14 w-14`} />}
                    badge={<Cloud className={`h-6 w-6`} />}
                />
            </div>
            <div
                className={`flex items-center justify-center rounded-md p-6 text-white`}
                style={dotsStyle}
            >
                <IconBadge
                    size={56}
                    icon={<Folder className={`h-14 w-14`} />}
                    badge={<Lock className={`h-6 w-6`} />}
                />
            </div>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.iconBadge.patterns,
    Example
};

export default module;

import { type ReactNode } from "react";
import type { Translation } from "../languages";
import { CreatingAppsGuide } from "./CreatingAppsGuide";
import { registerGuideLinks } from "../componentLinkRegistry";

export interface GuideEntry {
    readonly id: string;
    /** PascalCase, used as the URL path under `/guide/`. */
    readonly name: string;
    /** Resolve the user-facing label from the active translation tree. */
    readonly label: (t: Translation) => string;
    readonly render: () => ReactNode;
}

export const guides: ReadonlyArray<GuideEntry> = [
    {
        id: `creating-apps`,
        name: `CreatingApps`,
        label: (t) => t.example.sidebar.creatingAppsLabel,
        render: () => <CreatingAppsGuide />
    }
];

// Feed the cross-doc link registry — same pattern as `demos.tsx`. Lets
// prose like `<CreatingApps>` (in any doc page's body string) resolve to
// `/guide/CreatingApps` automatically.
registerGuideLinks(guides);

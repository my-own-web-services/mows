import { BookOpen, Languages, Settings } from "lucide-react";
import { type ComponentType, type ReactNode } from "react";
import type { Translation } from "../languages";
import { CreatingAppsGuide } from "./CreatingAppsGuide";
import { SettingsSystemGuide } from "./SettingsSystemGuide";
import { TranslationsGuide } from "./TranslationsGuide";
import { registerGuideLinks } from "../componentLinkRegistry";

// Widened from `LucideIcon` so future guide entries can register custom
// SVG components or icons from a different set. The intersection holds:
// every `LucideIcon` already satisfies this `ComponentType` shape.
export type GuideIconComponent = ComponentType<{
    readonly className?: string;
    readonly "aria-hidden"?: boolean;
}>;

export interface GuideEntry {
    readonly id: string;
    /** PascalCase, used as the URL path under `/guide/`. */
    readonly name: string;
    /** Resolve the user-facing label from the active translation tree. */
    readonly label: (t: Translation) => string;
    /** Icon shown next to the guide's entry in the sidebar nav. */
    readonly icon: GuideIconComponent;
    readonly render: () => ReactNode;
}

export const guides: ReadonlyArray<GuideEntry> = [
    {
        id: `creating-apps`,
        name: `CreatingApps`,
        label: (t) => t.example.sidebar.creatingAppsLabel,
        icon: BookOpen,
        render: () => <CreatingAppsGuide />
    },
    {
        id: `translations`,
        name: `Translations`,
        label: (t) => t.example.sidebar.translationsLabel,
        icon: Languages,
        render: () => <TranslationsGuide />
    },
    {
        id: `settings-system`,
        name: `SettingsSystem`,
        label: (t) => t.example.sidebar.settingsSystemLabel,
        icon: Settings,
        render: () => <SettingsSystemGuide />
    }
];

// Feed the cross-doc link registry — same pattern as `demos.tsx`. Lets
// prose like `<CreatingApps>` (in any doc page's body string) resolve to
// `/guide/CreatingApps` automatically.
registerGuideLinks(guides);

import type { ComponentType } from "react";
import type { Translation } from "../../languages";

export interface ExampleStrings {
    readonly title: string;
    readonly description: string;
}

/**
 * Selector that extracts an example's title + description from the
 * `Translation['example']` subtree. Each example file declares its own
 * selector, e.g. `(t) => t.examples.steps.horizontal`.
 */
export type ExampleStringsSelector = (
    t: Translation[`example`]
) => ExampleStrings;

export interface ExampleModule {
    readonly strings: ExampleStringsSelector;
    readonly Example: ComponentType;
}

export interface RegisteredExample extends ExampleModule {
    readonly id: string;
    /** Raw TSX source of the example file, loaded via Vite's `?raw` suffix. */
    readonly source: string;
}

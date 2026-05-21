import disabled from "./Disabled";
import disabledSource from "./Disabled.tsx?raw";
import horizontal from "./Horizontal";
import horizontalSource from "./Horizontal.tsx?raw";
import icons from "./Icons";
import iconsSource from "./Icons.tsx?raw";
import rtl from "./RTL";
import rtlSource from "./RTL.tsx?raw";
import selection from "./Selection";
import selectionSource from "./Selection.tsx?raw";
import statusOverride from "./StatusOverride";
import statusOverrideSource from "./StatusOverride.tsx?raw";
import vertical from "./Vertical";
import verticalSource from "./Vertical.tsx?raw";
import wizard from "./Wizard";
import wizardSource from "./Wizard.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const stepsExamples: ReadonlyArray<RegisteredExample> = [
    { id: `horizontal`, source: horizontalSource, ...horizontal },
    { id: `vertical`, source: verticalSource, ...vertical },
    { id: `selection`, source: selectionSource, ...selection },
    { id: `statusOverride`, source: statusOverrideSource, ...statusOverride },
    { id: `wizard`, source: wizardSource, ...wizard },
    { id: `disabled`, source: disabledSource, ...disabled },
    { id: `icons`, source: iconsSource, ...icons },
    { id: `rtl`, source: rtlSource, ...rtl }
];

export const stepsExampleById = (id: string): RegisteredExample => {
    const found = stepsExamples.find((e) => e.id === id);
    if (!found) throw new Error(`No steps example registered with id "${id}"`);
    return found;
};

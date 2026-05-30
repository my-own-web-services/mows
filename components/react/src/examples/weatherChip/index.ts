import currentModule from "./Current";
import currentSource from "./Current.tsx?raw";
import emptyModule from "./Empty";
import emptySource from "./Empty.tsx?raw";
import errorModule from "./ErrorState";
import errorSource from "./ErrorState.tsx?raw";
import forecastModule from "./Forecast";
import forecastSource from "./Forecast.tsx?raw";
import historicalModule from "./Historical";
import historicalSource from "./Historical.tsx?raw";
import loadingModule from "./Loading";
import loadingSource from "./Loading.tsx?raw";
import localisedModule from "./Localised";
import localisedSource from "./Localised.tsx?raw";
import overMapModule from "./OverMap";
import overMapSource from "./OverMap.tsx?raw";
import rtlModule from "./Rtl";
import rtlSource from "./Rtl.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const weatherChipExamples: ReadonlyArray<RegisteredExample> = [
    { id: `current`, source: currentSource, ...currentModule },
    { id: `forecast`, source: forecastSource, ...forecastModule },
    { id: `historical`, source: historicalSource, ...historicalModule },
    { id: `loading`, source: loadingSource, ...loadingModule },
    { id: `error`, source: errorSource, ...errorModule },
    { id: `empty`, source: emptySource, ...emptyModule },
    { id: `overMap`, source: overMapSource, ...overMapModule },
    { id: `localised`, source: localisedSource, ...localisedModule },
    { id: `rtl`, source: rtlSource, ...rtlModule }
];

export const weatherChipExampleById = (id: string): RegisteredExample => {
    const found = weatherChipExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No weatherChip example registered with id "${id}"`);
    return found;
};

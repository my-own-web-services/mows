import area from "./Area";
import areaSource from "./Area.tsx?raw";
import bar from "./Bar";
import barSource from "./Bar.tsx?raw";
import line from "./Line";
import lineSource from "./Line.tsx?raw";
import pie from "./Pie";
import pieSource from "./Pie.tsx?raw";
import radar from "./Radar";
import radarSource from "./Radar.tsx?raw";
import radial from "./Radial";
import radialSource from "./Radial.tsx?raw";
import themed from "./Themed";
import themedSource from "./Themed.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const chartExamples: ReadonlyArray<RegisteredExample> = [
    { id: `bar`, source: barSource, ...bar },
    { id: `line`, source: lineSource, ...line },
    { id: `area`, source: areaSource, ...area },
    { id: `pie`, source: pieSource, ...pie },
    { id: `radar`, source: radarSource, ...radar },
    { id: `radial`, source: radialSource, ...radial },
    { id: `themed`, source: themedSource, ...themed }
];

export const chartExampleById = (id: string): RegisteredExample => {
    const found = chartExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No chart example registered with id "${id}"`);
    return found;
};

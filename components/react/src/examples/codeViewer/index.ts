import defaultExample from "./Default";
import defaultSource from "./Default.tsx?raw";
import editable from "./Editable";
import editableSource from "./Editable.tsx?raw";
import fitContent from "./FitContent";
import fitContentSource from "./FitContent.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const codeViewerExamples: ReadonlyArray<RegisteredExample> = [
    { id: `default`, source: defaultSource, ...defaultExample },
    { id: `editable`, source: editableSource, ...editable },
    { id: `fitContent`, source: fitContentSource, ...fitContent }
];

export const codeViewerExampleById = (id: string): RegisteredExample => {
    const found = codeViewerExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No codeViewer example registered with id "${id}"`);
    return found;
};

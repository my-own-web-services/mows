import block from "./Block";
import blockSource from "./Block.tsx?raw";
import inline from "./Inline";
import inlineSource from "./Inline.tsx?raw";
import languages from "./Languages";
import languagesSource from "./Languages.tsx?raw";
import type { RegisteredExample } from "../harness/types";

export const codeSnippetExamples: ReadonlyArray<RegisteredExample> = [
    { id: `block`, source: blockSource, ...block },
    { id: `inline`, source: inlineSource, ...inline },
    { id: `languages`, source: languagesSource, ...languages }
];

export const codeSnippetExampleById = (id: string): RegisteredExample => {
    const found = codeSnippetExamples.find((example) => example.id === id);
    if (!found) throw new Error(`No codeSnippet example registered with id "${id}"`);
    return found;
};

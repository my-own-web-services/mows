import { describe, expect, it } from "vitest";
import { cleanExampleSource } from "./cleanExampleSource";

describe(`cleanExampleSource`, () => {
    it(`strips harness imports, useExampleState calls, and the trailing module`, () => {
        const raw = [
            `import { useState } from "react";`,
            `import { Step, Steps } from "../../../lib/components/ui/steps";`,
            `import { useExampleState } from "../harness/useExampleState";`,
            `import type { ExampleModule } from "../harness/types";`,
            ``,
            `const Example = () => {`,
            `    const [current, setCurrent] = useState(1);`,
            `    useExampleState({ current });`,
            `    return <Steps current={current} />;`,
            `};`,
            ``,
            `const module: ExampleModule = {`,
            `    strings: (t) => t.steps.horizontal,`,
            `    Example`,
            `};`,
            `export default module;`,
            ``
        ].join(`\n`);

        const out = cleanExampleSource(raw);
        expect(out).not.toContain(`useExampleState`);
        expect(out).not.toContain(`ExampleModule`);
        expect(out).not.toContain(`harness/`);
        expect(out).toContain(`const Example = () => {`);
        expect(out).toContain(`return <Steps current={current} />;`);
        expect(out.endsWith(`\n`)).toBe(true);
    });

    it(`keeps lines that mention useExampleState as a substring but aren't standalone calls`, () => {
        // a hypothetical comment or other token that happens to contain the
        // string — we only filter standalone call statements.
        const raw = [
            `// useExampleState publishes the state`,
            `const Example = () => null;`,
            ``,
            `const module: ExampleModule = { strings: (t) => t.x, Example };`
        ].join(`\n`);

        const out = cleanExampleSource(raw);
        expect(out).toContain(`// useExampleState publishes the state`);
    });

    it(`leaves regular code untouched when no harness lines are present`, () => {
        const raw = `import { Button } from "x";\n\nexport const Example = () => <Button />;\n`;
        expect(cleanExampleSource(raw)).toBe(raw);
    });

    it(`strips multi-line useExampleState calls until their parens balance`, () => {
        const raw = [
            `const Example = () => {`,
            `    useExampleState({`,
            `        current: 1,`,
            `        overrides: { a: \`x\`, b: \`y\` }`,
            `    });`,
            `    return <div />;`,
            `};`,
            ``,
            `const module: ExampleModule = { strings: (t) => t.x, Example };`
        ].join(`\n`);

        const out = cleanExampleSource(raw);
        expect(out).not.toContain(`useExampleState`);
        expect(out).not.toContain(`current: 1`);
        expect(out).not.toContain(`overrides:`);
        expect(out).toContain(`return <div />;`);
    });

    it(`is not fooled by parens inside strings on the useExampleState opener`, () => {
        const raw = [
            `const Example = () => {`,
            `    useExampleState({ msg: \`a (b) c\` });`,
            `    return null;`,
            `};`
        ].join(`\n`);

        const out = cleanExampleSource(raw);
        expect(out).not.toContain(`useExampleState`);
        expect(out).toContain(`return null;`);
    });
});

/**
 * The example files contain harness-only scaffolding that would distract a
 * reader copying the snippet into their own project. This helper removes:
 *
 * - the `useExampleState` / harness type imports
 * - any `useExampleState(...)` call statements (single- or multi-line)
 * - the trailing `const module: ExampleModule = { ... }; export default module;`
 *   boilerplate
 *
 * The result is the bare `Example` component + its real imports — what a
 * consumer would actually paste into their own code.
 */

// Counts the net change in paren depth across a line, ignoring parens
// inside string / template literals so we don't get confused by code
// like `() =>` embedded in a string. Backslash escapes inside strings
// are honored.
const netParenDelta = (line: string): number => {
    let depth = 0;
    let index = 0;
    let inString: false | `"` | `'` | `\`` = false;
    while (index < line.length) {
        const character = line[index];
        if (inString) {
            if (character === `\\`) {
                index += 2;
                continue;
            }
            if (character === inString) inString = false;
        } else if (character === `"` || character === `'` || character === `\``) {
            inString = character;
        } else if (character === `(`) {
            depth++;
        } else if (character === `)`) {
            depth--;
        }
        index++;
    }
    return depth;
};

export const cleanExampleSource = (raw: string): string => {
    const lines = raw.split(`\n`);
    const cleaned: string[] = [];
    // When a `useExampleState(...)` call spans multiple lines, this tracks
    // how many unclosed parens remain inside that call so we keep
    // dropping lines until it balances.
    let pendingCallDepth = 0;

    for (const line of lines) {
        if (pendingCallDepth > 0) {
            pendingCallDepth += netParenDelta(line);
            if (pendingCallDepth < 0) pendingCallDepth = 0;
            continue;
        }

        // Stop at the boilerplate trailer.
        if (/^\s*const\s+module\s*:\s*ExampleModule\b/.test(line)) {
            break;
        }
        // Drop harness imports (named imports and type imports).
        if (/^\s*import\s+(?:type\s+)?\{[^}]*\}\s+from\s+["']\.\.\/harness\//.test(line)) {
            continue;
        }
        // Drop `useExampleState(...)` call statements. Calls may span
        // multiple lines; once we see the opener, swallow lines until
        // the parens balance.
        if (/^\s*useExampleState\s*\(/.test(line)) {
            const delta = netParenDelta(line);
            pendingCallDepth = delta > 0 ? delta : 0;
            continue;
        }
        cleaned.push(line);
    }

    // Trim trailing blank lines left behind by the boilerplate trailer
    // having been chopped off.
    while (cleaned.length > 0 && cleaned[cleaned.length - 1].trim() === ``) {
        cleaned.pop();
    }

    return `${cleaned.join(`\n`)}\n`;
};

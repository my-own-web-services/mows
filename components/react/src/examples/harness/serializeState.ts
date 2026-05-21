/**
 * Pretty-print arbitrary example state for the State tab.
 *
 * Plain `JSON.stringify` throws on circular references and silently drops
 * functions. Both occur naturally in React state (e.g. an onChange
 * callback or a state object that holds a DOM ref). This replacer turns
 * them into stable placeholder strings so the State tab always renders
 * something deterministic.
 */
export const serializeState = (state: unknown): string => {
    if (state === null || state === undefined) {
        return `null`;
    }
    const seen = new WeakSet<object>();
    return JSON.stringify(
        state,
        (_key, value) => {
            if (typeof value === `function`) {
                return `[Function${value.name ? ` ${value.name}` : ``}]`;
            }
            if (typeof value === `symbol`) {
                return value.toString();
            }
            if (typeof value === `bigint`) {
                return `${value.toString()}n`;
            }
            if (typeof value === `undefined`) {
                return `[undefined]`;
            }
            if (value instanceof Date) {
                return value.toISOString();
            }
            if (value instanceof Error) {
                return `[${value.name}: ${value.message}]`;
            }
            if (value instanceof Element) {
                return `[Element <${value.tagName.toLowerCase()}>]`;
            }
            if (value instanceof Node) {
                return `[Node ${value.nodeName}]`;
            }
            if (typeof value === `object` && value !== null) {
                if (seen.has(value)) {
                    return `[Circular]`;
                }
                seen.add(value);
            }
            return value;
        },
        2
    );
};

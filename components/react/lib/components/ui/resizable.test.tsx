import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import {
    collectDefaults,
    ResizableHandle,
    ResizablePanel
} from "./resizable";

// `collectDefaults` powers the double-click reset on `ResizableHandle`.
// Apps commonly only declare a `defaultSize` on the sidebar panel and let
// the content pane fill the rest, so the helper has to invent a sensible
// remainder for any undeclared panels — otherwise the reset would silently
// no-op the way it did before this regression got fixed.
describe(`collectDefaults`, () => {
    it(`returns the declared sizes when every panel supplies one`, () => {
        const children = [
            <ResizablePanel key={`a`} defaultSize={30} />,
            <ResizableHandle key={`h`} />,
            <ResizablePanel key={`b`} defaultSize={70} />
        ];
        expect(collectDefaults(children)).toEqual([30, 70]);
    });

    it(`fills missing defaults with the remainder split evenly`, () => {
        const children = [
            <ResizablePanel key={`a`} defaultSize={20} />,
            <ResizableHandle key={`h`} />,
            <ResizablePanel key={`b`} />
        ];
        expect(collectDefaults(children)).toEqual([20, 80]);
    });

    it(`splits the remainder across multiple panels without defaults`, () => {
        const children = [
            <ResizablePanel key={`a`} defaultSize={40} />,
            <ResizableHandle key={`h1`} />,
            <ResizablePanel key={`b`} />,
            <ResizableHandle key={`h2`} />,
            <ResizablePanel key={`c`} />
        ];
        expect(collectDefaults(children)).toEqual([40, 30, 30]);
    });

    it(`returns null when an undeclared panel would need a negative remainder`, () => {
        // Declared sizes already exceed 100, so there's no positive filler we
        // can hand the undeclared panel — bail out and skip the reset.
        const children = [
            <ResizablePanel key={`a`} defaultSize={70} />,
            <ResizableHandle key={`h`} />,
            <ResizablePanel key={`b`} defaultSize={70} />,
            <ResizableHandle key={`h2`} />,
            <ResizablePanel key={`c`} />
        ];
        expect(collectDefaults(children)).toBeNull();
    });

    it(`returns null when there are no panels`, () => {
        expect(collectDefaults(<div />)).toBeNull();
    });
});

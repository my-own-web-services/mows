import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ImageViewer from "./ImageViewer";

describe(`ImageViewer`, () => {
    it(`renders eagerly by default`, () => {
        const { container } = render(<ImageViewer src={`/a.png`} alt={`a`} />);
        const img = container.querySelector(`img`)!;
        expect(img).toBeInTheDocument();
        expect(img.getAttribute(`loading`)).toBe(`eager`);
        expect(img.getAttribute(`decoding`)).toBeNull();
        expect(img.getAttribute(`fetchpriority`)).toBeNull();
    });

    it(`switches to lazy + async + low priority when embedded`, () => {
        const { container } = render(<ImageViewer src={`/a.png`} alt={`a`} embedded />);
        const img = container.querySelector(`img`)!;
        expect(img.getAttribute(`loading`)).toBe(`lazy`);
        expect(img.getAttribute(`decoding`)).toBe(`async`);
        expect(img.getAttribute(`fetchpriority`)).toBe(`low`);
    });

    it(`forwards width and height so layout reserves space`, () => {
        const { container } = render(
            <ImageViewer src={`/a.png`} alt={`a`} width={120} height={80} embedded />
        );
        const img = container.querySelector(`img`)!;
        expect(img.getAttribute(`width`)).toBe(`120`);
        expect(img.getAttribute(`height`)).toBe(`80`);
    });
});

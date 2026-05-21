import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getIconForFilePath } from "vscode-material-icons";
import FileIcon from "./FileIcon";

// Sanity-check the upstream resolver is wired up: if these stop returning
// the expected icon names the assertions below need to be revisited.
describe(`getIconForFilePath upstream contract`, () => {
    it(`resolves extensions, exact names, and the default fallback`, () => {
        expect(getIconForFilePath(`app.ts`)).toBe(`typescript`);
        expect(getIconForFilePath(`Dockerfile`)).toBe(`docker`);
        expect(getIconForFilePath(`README.md`)).toBe(`readme`);
        expect(getIconForFilePath(`package.json`)).toBe(`nodejs`);
        expect(getIconForFilePath(`thing.unknownzzz`)).toBe(`file`);
    });
});

describe(`FileIcon`, () => {
    it(`resolves a file extension to the matching icon`, () => {
        render(<FileIcon fileName={`app.ts`} size={24} />);
        const img = screen.getByRole(`img`);
        expect(img).toHaveAttribute(`alt`, `app.ts file icon`);
        expect(img.getAttribute(`src`)).toBeTruthy();
    });

    it(`prefers an exact file-name match over extension`, () => {
        // `package.json` would resolve to the json icon by extension, but the
        // upstream fileNames table wins and returns the nodejs icon. Compare
        // against a bare data.json to prove the URLs differ.
        const { rerender } = render(<FileIcon fileName={`package.json`} size={24} />);
        const packageSrc = screen.getByRole(`img`).getAttribute(`src`);
        rerender(<FileIcon fileName={`data.json`} size={24} />);
        const jsonSrc = screen.getByRole(`img`).getAttribute(`src`);
        expect(packageSrc).not.toBe(jsonSrc);
    });

    it(`renders the default file icon for unknown extensions`, () => {
        // Upstream maps the unknown extension to the `file` icon, which the
        // package ships — so we expect a real <img>, not the lucide fallback.
        render(<FileIcon fileName={`thing.unknownzzz`} size={24} />);
        const img = screen.getByRole(`img`);
        expect(img).toHaveAttribute(`alt`, `thing.unknownzzz file icon`);
    });

    it(`forwards the size prop to the rendered image`, () => {
        render(<FileIcon fileName={`app.ts`} size={48} />);
        const img = screen.getByRole(`img`);
        expect(img).toHaveAttribute(`width`, `48`);
        expect(img).toHaveAttribute(`height`, `48`);
    });

    it(`re-resolves when fileName changes`, () => {
        const { rerender } = render(<FileIcon fileName={`app.ts`} size={24} />);
        const firstSrc = screen.getByRole(`img`).getAttribute(`src`);
        rerender(<FileIcon fileName={`README.md`} size={24} />);
        const img = screen.getByRole(`img`);
        expect(img).toHaveAttribute(`alt`, `README.md file icon`);
        expect(img.getAttribute(`src`)).not.toBe(firstSrc);
    });

    it(`switches to the lucide fallback when the image load fails`, () => {
        const { container } = render(<FileIcon fileName={`app.ts`} size={24} />);
        const img = container.querySelector(`img`)!;
        // Use fireEvent so React's synthetic onError handler fires.
        fireEvent.error(img);
        expect(container.querySelector(`img`)).toBeNull();
        expect(container.querySelector(`svg.lucide-file`)).toBeInTheDocument();
    });
});

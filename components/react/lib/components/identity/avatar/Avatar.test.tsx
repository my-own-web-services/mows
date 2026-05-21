import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Avatar from "./Avatar";

describe(`Avatar`, () => {
    it(`shows the uppercased first letter of displayName`, () => {
        render(<Avatar displayName={`alice`} />);
        expect(screen.getByText(`A`)).toBeInTheDocument();
    });

    it(`accepts non-ASCII first letters`, () => {
        render(<Avatar displayName={`über`} />);
        // Note: localeCompare uppercase of "ü" is "Ü"
        expect(screen.getByText(`Ü`)).toBeInTheDocument();
    });

    it(`renders the skeleton placeholder when displayName is omitted`, () => {
        const { container } = render(<Avatar />);
        // Skeleton renders a div with animate-pulse.
        const placeholder = container.querySelector(`.animate-pulse`);
        expect(placeholder).not.toBeNull();
    });

    it(`renders the skeleton placeholder when displayName is empty`, () => {
        const { container } = render(<Avatar displayName={``} />);
        const placeholder = container.querySelector(`.animate-pulse`);
        expect(placeholder).not.toBeNull();
    });

    it(`merges className onto the outer wrapper`, () => {
        const { container } = render(<Avatar displayName={`Bob`} className={`my-av`} />);
        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper.className).toMatch(/my-av/);
        expect(wrapper.className).toMatch(/rounded-full/);
    });

    it(`forwards inline style onto the wrapper`, () => {
        const { container } = render(
            <Avatar displayName={`Bob`} style={{ marginLeft: 12 }} />
        );
        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper.style.marginLeft).toBe(`12px`);
    });
});

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { COMPONENT_SIZE_OPTIONS } from "@/lib/constants";
import ButtonSelect, { type ButtonSelectOption } from "./ButtonSelect";

// Mock icons for testing
const TestIcon1 = () => <span data-testid="icon-1">📁</span>;
const TestIcon2 = () => <span data-testid="icon-2">📄</span>;
const TestIcon3 = () => <span data-testid="icon-3">⚙️</span>;

const mockOptions: ButtonSelectOption[] = [
    { id: "folder", icon: <TestIcon1 />, label: "Folder View" },
    { id: "file", icon: <TestIcon2 />, label: "File View" },
    { id: "settings", icon: <TestIcon3 />, label: "Settings", disabled: true }
];

describe("ButtonSelect", () => {
    it("renders all options", () => {
        const onSelectionChange = vi.fn();
        render(
            <ButtonSelect
                options={mockOptions}
                selectedId="folder"
                onSelectionChange={onSelectionChange}
            />
        );

        expect(screen.getByTestId("icon-1")).toBeInTheDocument();
        expect(screen.getByTestId("icon-2")).toBeInTheDocument();
        expect(screen.getByTestId("icon-3")).toBeInTheDocument();
    });

    it("shows selected option with default variant", () => {
        const onSelectionChange = vi.fn();
        render(
            <ButtonSelect
                options={mockOptions}
                selectedId="folder"
                onSelectionChange={onSelectionChange}
            />
        );

        const selectedButton = screen.getByTitle("Folder View");
        expect(selectedButton).toHaveAttribute("aria-pressed", "true");
    });

    it("shows non-selected options with outline variant", () => {
        const onSelectionChange = vi.fn();
        render(
            <ButtonSelect
                options={mockOptions}
                selectedId="folder"
                onSelectionChange={onSelectionChange}
            />
        );

        const nonSelectedButton = screen.getByTitle("File View");
        expect(nonSelectedButton).toHaveAttribute("aria-pressed", "false");
    });

    it("calls onSelectionChange when option is clicked", () => {
        const onSelectionChange = vi.fn();
        render(
            <ButtonSelect
                options={mockOptions}
                selectedId="folder"
                onSelectionChange={onSelectionChange}
            />
        );

        const fileButton = screen.getByTitle("File View");
        fireEvent.click(fileButton);

        expect(onSelectionChange).toHaveBeenCalledWith("file");
    });

    it("does not call onSelectionChange when disabled option is clicked", () => {
        const onSelectionChange = vi.fn();
        render(
            <ButtonSelect
                options={mockOptions}
                selectedId="folder"
                onSelectionChange={onSelectionChange}
            />
        );

        const settingsButton = screen.getByTitle("Settings");
        fireEvent.click(settingsButton);

        expect(onSelectionChange).not.toHaveBeenCalled();
    });

    it("does not call onSelectionChange when component is disabled", () => {
        const onSelectionChange = vi.fn();
        render(
            <ButtonSelect
                options={mockOptions}
                selectedId="folder"
                onSelectionChange={onSelectionChange}
                disabled
            />
        );

        const fileButton = screen.getByTitle("File View");
        fireEvent.click(fileButton);

        expect(onSelectionChange).not.toHaveBeenCalled();
    });

    it("applies custom className", () => {
        const onSelectionChange = vi.fn();
        const { container } = render(
            <ButtonSelect
                options={mockOptions}
                selectedId="folder"
                onSelectionChange={onSelectionChange}
                className="custom-class"
            />
        );

        const buttonGroup = container.querySelector(".ButtonSelect");
        expect(buttonGroup).toHaveClass("custom-class");
    });

    it("applies custom styles", () => {
        const onSelectionChange = vi.fn();
        const customStyle = { backgroundColor: "red" };
        const { container } = render(
            <ButtonSelect
                options={mockOptions}
                selectedId="folder"
                onSelectionChange={onSelectionChange}
                style={customStyle}
            />
        );

        const buttonGroup = container.querySelector(".ButtonSelect");
        expect(buttonGroup).toHaveStyle("background-color: rgb(255, 0, 0)");
    });

    it("has proper accessibility attributes", () => {
        const onSelectionChange = vi.fn();
        const { container } = render(
            <ButtonSelect
                options={mockOptions}
                selectedId="folder"
                onSelectionChange={onSelectionChange}
            />
        );

        const buttonGroup = container.querySelector(".ButtonSelect");
        expect(buttonGroup).toHaveAttribute("role", "group");
        expect(buttonGroup).toHaveAttribute("aria-label", "Button group");
    });

    it("accepts all size options from COMPONENT_SIZE_OPTIONS", () => {
        const onSelectionChange = vi.fn();

        COMPONENT_SIZE_OPTIONS.forEach((size) => {
            const { unmount } = render(
                <ButtonSelect
                    options={mockOptions}
                    selectedId="folder"
                    onSelectionChange={onSelectionChange}
                    size={size}
                />
            );
            // If it renders without error, the size is valid
            expect(screen.getByTestId("icon-1")).toBeInTheDocument();
            unmount();
        });
    });
});
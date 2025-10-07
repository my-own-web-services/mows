import { fireEvent, render, screen } from "@testing-library/react";
import { TagResourceType } from "filez-client-typescript";
import { describe, expect, it, vi } from "vitest";
import ResourceTags, { type ResourceTagsMap } from "./ResourceTags";

describe("ResourceTags", () => {
    const mockResourceType = TagResourceType.File;

    describe("tagsToString", () => {
        it("returns empty string for empty tag map", () => {
            const component = new ResourceTags({
                tagsMap: {},
                resourceType: mockResourceType
            });

            expect(component.tagsToString({})).toBe("");
        });

        it("returns comma-separated tags for single resource", () => {
            const tagsMap: ResourceTagsMap = {
                file1: [
                    { key: "city", value: "augsburg" },
                    { key: "country", value: "germany" }
                ]
            };

            const component = new ResourceTags({
                tagsMap,
                resourceType: mockResourceType
            });

            expect(component.tagsToString(tagsMap)).toBe("city=augsburg, country=germany");
        });

        it("adds asterisks for differing values across multiple resources", () => {
            const tagsMap: ResourceTagsMap = {
                file1: [
                    { key: "city", value: "augsburg" },
                    { key: "country", value: "germany" }
                ],
                file2: [
                    { key: "city", value: "münchen" },
                    { key: "country", value: "germany" }
                ]
            };

            const component = new ResourceTags({
                tagsMap,
                resourceType: mockResourceType
            });

            const result = component.tagsToString(tagsMap);
            expect(result).toContain("city=augsburg*");
            expect(result).toContain("city=münchen*");
            expect(result).toContain("country=germany");
            expect(result).not.toContain("country=germany*");
        });

        it("handles resources with different tag sets", () => {
            const tagsMap: ResourceTagsMap = {
                file1: [
                    { key: "city", value: "augsburg" },
                    { key: "type", value: "document" }
                ],
                file2: [
                    { key: "city", value: "münchen" },
                    { key: "category", value: "personal" }
                ]
            };

            const component = new ResourceTags({
                tagsMap,
                resourceType: mockResourceType
            });

            const result = component.tagsToString(tagsMap);
            expect(result).toContain("city=augsburg*");
            expect(result).toContain("city=münchen*");
            // Tags that only exist on one resource don't get asterisks
            expect(result).toContain("type=document");
            expect(result).toContain("category=personal");
            expect(result).not.toContain("type=document*");
            expect(result).not.toContain("category=personal*");
        });
    });

    describe("stringToTags", () => {
        it("remove tags if field is set to empty", () => {
            const tagsMap: ResourceTagsMap = {
                file1: [{ key: "city", value: "augsburg" }]
            };

            const component = new ResourceTags({
                tagsMap,
                resourceType: mockResourceType
            });

            const result = component.stringToTags("");
            expect(result.resourceIds).toEqual(["file1"]);
            expect(result.add).toEqual([]);
            expect(result.remove).toEqual([{ key: "city", value: "augsburg" }]);
            expect(result.resourceType).toBe(mockResourceType);
        });

        it("parses simple key=value pairs without asterisks", () => {
            const tagsMap: ResourceTagsMap = {
                file1: [],
                file2: []
            };

            const component = new ResourceTags({
                tagsMap,
                resourceType: mockResourceType
            });

            const result = component.stringToTags("city=berlin, country=germany");
            expect(result.add).toContainEqual({ key: "city", value: "berlin" });
            expect(result.add).toContainEqual({ key: "country", value: "germany" });
            expect(result.remove).toEqual([]);
            expect(result.resourceIds).toEqual(["file1", "file2"]);
        });

        it("should make sure that nothing changes when the asterisks are still present", () => {
            const tagsMap: ResourceTagsMap = {
                file1: [{ key: "city", value: "augsburg" }],
                file2: [{ key: "city", value: "münchen" }]
            };

            const component = new ResourceTags({
                tagsMap,
                resourceType: mockResourceType
            });

            const result = component.stringToTags("city=augsburg*, city=münchen*");
            expect(result.add).toEqual([]);
            expect(result.remove).toEqual([]);
            expect(result.resourceIds).toEqual([]);
        });

        it("should not change anything", () => {
            const tagsMap: ResourceTagsMap = {
                bildVonNürnberg: [
                    { key: "City", value: "Nürnberg" },
                    { key: "Country", value: "Germany" }
                ],
                bildVonAugsburg: [
                    { key: "City", value: "Augsburg" },
                    { key: "Country", value: "Germany" }
                ]
            };

            const component = new ResourceTags({
                tagsMap,
                resourceType: mockResourceType
            });

            const result = component.stringToTags(
                "City=Nürnberg*, City=Augsburg*, Country=Germany"
            );
            expect(result.add).toEqual([]);
            expect(result.remove).toEqual([]);
            expect(result.resourceIds).toEqual([]);
        });

        it("handles mixed asterisked and non-asterisked values", () => {
            const tagsMap: ResourceTagsMap = {
                bildVonNürnberg: [
                    { key: "City", value: "Nürnberg" },
                    { key: "Country", value: "Germany" }
                ],
                bildVonAugsburg: [
                    { key: "City", value: "Augsburg" },
                    { key: "Country", value: "Germany" }
                ]
            };

            const component = new ResourceTags({
                tagsMap,
                resourceType: mockResourceType
            });

            const result = component.stringToTags("City=Nürnberg*, City=Augsburg, Country=Germany");
            expect(result.add).toEqual([{ key: "City", value: "Augsburg" }]);
            expect(result.remove).toEqual([]);
            expect(result.resourceIds).toEqual(["bildVonNürnberg"]);
        });
    });

    describe("component rendering and interaction", () => {
        it("renders with correct initial state", () => {
            const tagsMap: ResourceTagsMap = {
                file1: [{ key: "city", value: "augsburg" }]
            };

            render(<ResourceTags tagsMap={tagsMap} resourceType={mockResourceType} />);

            expect(screen.getByText("1 selected")).toBeInTheDocument();
            expect(screen.getByTitle("Badges")).toBeInTheDocument();
            expect(screen.getByTitle("Text")).toBeInTheDocument();
        });

        it("switches between modes when clicking buttons", () => {
            const tagsMap: ResourceTagsMap = {
                file1: [{ key: "city", value: "augsburg" }]
            };

            render(<ResourceTags tagsMap={tagsMap} resourceType={mockResourceType} />);

            fireEvent.click(screen.getByTitle("Text"));
            expect(screen.getByRole("textbox")).toBeInTheDocument();

            fireEvent.click(screen.getByTitle("Badges"));
            expect(screen.getByText("Tags Badges Mode - Not Implemented")).toBeInTheDocument();
        });

        it("displays correct text in textarea for single resource", () => {
            const tagsMap: ResourceTagsMap = {
                file1: [
                    { key: "city", value: "augsburg" },
                    { key: "country", value: "germany" }
                ]
            };

            render(<ResourceTags tagsMap={tagsMap} resourceType={mockResourceType} />);

            fireEvent.click(screen.getByTitle("Text"));
            const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
            expect(textarea.value).toBe("city=augsburg, country=germany");
        });

        it("calls onCommit when textarea loses focus", () => {
            const mockOnCommit = vi.fn();
            const tagsMap: ResourceTagsMap = {
                file1: [{ key: "city", value: "augsburg" }]
            };

            render(
                <ResourceTags
                    tagsMap={tagsMap}
                    resourceType={mockResourceType}
                    onCommit={mockOnCommit}
                />
            );

            fireEvent.click(screen.getByTitle("Text"));
            const textarea = screen.getByRole("textbox");

            fireEvent.change(textarea, { target: { value: "city=berlin" } });
            fireEvent.blur(textarea);

            expect(mockOnCommit).toHaveBeenCalledWith(
                expect.objectContaining({
                    resourceIds: ["file1"],
                    resourceType: mockResourceType,
                    add: [{ key: "city", value: "berlin" }],
                    remove: [{ key: "city", value: "augsburg" }]
                })
            );
        });

        it("updates textarea value when tagsMap prop changes", () => {
            const initialTagsMap: ResourceTagsMap = {
                file1: [{ key: "city", value: "augsburg" }]
            };

            const { rerender } = render(
                <ResourceTags tagsMap={initialTagsMap} resourceType={mockResourceType} />
            );

            fireEvent.click(screen.getByTitle("Text"));
            let textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
            expect(textarea.value).toBe("city=augsburg");

            const updatedTagsMap: ResourceTagsMap = {
                file1: [{ key: "city", value: "berlin" }]
            };

            rerender(<ResourceTags tagsMap={updatedTagsMap} resourceType={mockResourceType} />);

            textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
            expect(textarea.value).toBe("city=berlin");
        });
    });
});

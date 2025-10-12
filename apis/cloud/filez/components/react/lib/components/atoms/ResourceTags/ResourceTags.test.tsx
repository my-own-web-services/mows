import { FilezProvider } from "@/main";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TagResourceType } from "filez-client-typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ResourceTags, { type ResourceTagsMap, type TagSearchResponse } from "./ResourceTags";

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
                ],
                file3: [
                    { key: "city", value: "augsburg" },
                    { key: "category", value: "work" },
                    { key: "type", value: "document" }
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
            expect(result).toContain("type=document*");
            expect(result).toContain("category=personal*");
            expect(result).toContain("category=work*");
        });
    });

    describe("stringToTags", () => {
        it("remove tags if field is set to empty", () => {
            const tagsMap: ResourceTagsMap = {
                file1: [
                    { key: "city", value: "augsburg" },
                    { key: "type", value: "document" }
                ],
                file2: [
                    { key: "city", value: "münchen" },
                    { key: "category", value: "personal" }
                ],
                file3: [
                    { key: "city", value: "augsburg" },
                    { key: "category", value: "work" },
                    { key: "type", value: "document" }
                ]
            };

            const component = new ResourceTags({
                tagsMap,
                resourceType: mockResourceType
            });

            const workingTags = component.stringToTags("");
            const result = component.createChangeset(workingTags);
            expect(result.resourceType).toBe(mockResourceType);

            expect(result.add).toEqual([]);
            expect(result.remove).toContainEqual({ key: "city", value: "augsburg" });
            expect(result.remove).toContainEqual({ key: "type", value: "document" });
            expect(result.remove).toContainEqual({ key: "city", value: "münchen" });
            expect(result.remove).toContainEqual({ key: "category", value: "personal" });
            expect(result.remove).toContainEqual({ key: "category", value: "work" });
            expect(result.resourceIds).toContain("file1");
            expect(result.resourceIds).toContain("file2");
            expect(result.resourceIds).toContain("file3");
        });

        it("adds tags if none were present before", () => {
            const tagsMap: ResourceTagsMap = {
                file1: [],
                file2: []
            };
            const component = new ResourceTags({
                tagsMap,
                resourceType: mockResourceType
            });
            const workingTags = component.stringToTags("city=berlin, country=germany");
            const result = component.createChangeset(workingTags);
            expect(result.add).toContainEqual({ key: "city", value: "berlin" });
            expect(result.add).toContainEqual({ key: "country", value: "germany" });
            expect(result.remove).toEqual([]);
            expect(result.resourceIds).toEqual(["file1", "file2"]);
        });

        it("ignores an asterisk when adding a new tag", () => {
            const tagsMap: ResourceTagsMap = {
                file1: [],
                file2: []
            };
            const component = new ResourceTags({
                tagsMap,
                resourceType: mockResourceType
            });
            const workingTags = component.stringToTags("city=berlin*, country=germany*");
            const result = component.createChangeset(workingTags);
            expect(result.add).toContainEqual({ key: "city", value: "berlin" });
            expect(result.add).toContainEqual({ key: "country", value: "germany" });
            expect(result.remove).toEqual([]);
            expect(result.resourceIds).toEqual(["file1", "file2"]);
        });

        it("ignores an asterisk when adding one to an existing tag", () => {
            const tagsMap: ResourceTagsMap = {
                file1: [{ key: "city", value: "augsburg" }],
                file2: [{ key: "city", value: "augsburg" }]
            };
            const component = new ResourceTags({
                tagsMap,
                resourceType: mockResourceType
            });
            const workingTags = component.stringToTags("city=augsburg*");
            const result = component.createChangeset(workingTags);
            expect(result.add).toEqual([]);
            expect(result.remove).toEqual([]);
            expect(result.resourceIds).toEqual([]);
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

            const workingTags = component.stringToTags("city=berlin, country=germany");
            const result = component.createChangeset(workingTags);
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

            const workingTags = component.stringToTags("city=augsburg*, city=münchen*");
            const result = component.createChangeset(workingTags);
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

            const workingTags = component.stringToTags(
                "City=Nürnberg*, City=Augsburg*, Country=Germany"
            );
            const result = component.createChangeset(workingTags);
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
                ],
                bildVonFreiburg: [
                    { key: "City", value: "Freiburg" },
                    { key: "Country", value: "Germany" }
                ],
                bildVonKempten: [
                    { key: "City", value: "Kempten" },
                    { key: "Country", value: "Germany" }
                ]
            };

            const component = new ResourceTags({
                tagsMap,
                resourceType: mockResourceType
            });

            const workingTags = component.stringToTags(
                "City=Nürnberg*,City=Freiburg*,City=Kempten*, City=Augsburg, Country=Germany"
            );
            const result = component.createChangeset(workingTags);
            expect(result.add).toEqual([{ key: "City", value: "Augsburg" }]);
            expect(result.remove).toEqual([]);
            expect(result.resourceIds).toEqual([
                "bildVonNürnberg",
                "bildVonFreiburg",
                "bildVonKempten"
            ]);
        });
    });

    describe("convertMapToCommonTags", () => {
        it("converts empty tag map to empty array", () => {
            const component = new ResourceTags({
                tagsMap: {},
                resourceType: mockResourceType
            });

            const result = component.convertMapToCommonTags({});
            expect(result).toEqual([]);
        });

        it("handles single resource with multiple tags", () => {
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

            const result = component.convertMapToCommonTags(tagsMap);
            expect(result).toContainEqual({
                key: "city",
                value: "augsburg",
                assignedToAllResources: true
            });
            expect(result).toContainEqual({
                key: "country",
                value: "germany",
                assignedToAllResources: true
            });
        });

        it("marks tags as not assigned to all when values differ", () => {
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

            const result = component.convertMapToCommonTags(tagsMap);
            expect(result).toContainEqual({
                key: "city",
                value: "augsburg",
                assignedToAllResources: false
            });
            expect(result).toContainEqual({
                key: "city",
                value: "münchen",
                assignedToAllResources: false
            });
            expect(result).toContainEqual({
                key: "country",
                value: "germany",
                assignedToAllResources: true
            });
        });
    });

    describe("stringToTags (WorkingTag parsing)", () => {
        it("returns empty array for empty text", () => {
            const component = new ResourceTags({
                tagsMap: {},
                resourceType: mockResourceType
            });

            const result = component.stringToTags("");
            expect(result).toEqual([]);
        });

        it("parses simple key=value pairs as assigned to all", () => {
            const component = new ResourceTags({
                tagsMap: {},
                resourceType: mockResourceType
            });

            const result = component.stringToTags("city=berlin, country=germany");
            expect(result).toContainEqual({
                key: "city",
                value: "berlin",
                assignedToAllResources: true
            });
            expect(result).toContainEqual({
                key: "country",
                value: "germany",
                assignedToAllResources: true
            });
        });

        it("parses asterisked values as not assigned to all", () => {
            const component = new ResourceTags({
                tagsMap: {},
                resourceType: mockResourceType
            });

            const result = component.stringToTags("city=augsburg*, city=münchen*");
            expect(result).toContainEqual({
                key: "city",
                value: "augsburg",
                assignedToAllResources: false
            });
            expect(result).toContainEqual({
                key: "city",
                value: "münchen",
                assignedToAllResources: false
            });
        });

        it("handles mixed asterisked and non-asterisked values", () => {
            const component = new ResourceTags({
                tagsMap: {},
                resourceType: mockResourceType
            });

            const result = component.stringToTags("city=augsburg*, city=münchen*, country=germany");
            expect(result).toContainEqual({
                key: "city",
                value: "augsburg",
                assignedToAllResources: false
            });
            expect(result).toContainEqual({
                key: "city",
                value: "münchen",
                assignedToAllResources: false
            });
            expect(result).toContainEqual({
                key: "country",
                value: "germany",
                assignedToAllResources: true
            });
        });
    });

    describe("component rendering and interaction", () => {
        it("renders with correct initial state", async () => {
            const tagsMap: ResourceTagsMap = {
                file1: [{ key: "city", value: "augsburg" }]
            };

            render(
                <FilezProvider>
                    <ResourceTags tagsMap={tagsMap} resourceType={mockResourceType} />
                </FilezProvider>
            );

            // Wait for FilezProvider to load
            await waitFor(() => {
                expect(screen.getByText("1 selected")).toBeInTheDocument();
            });

            expect(screen.getByTitle("Badges")).toBeInTheDocument();
            expect(screen.getByTitle("Text")).toBeInTheDocument();
        });

        it("switches between modes when clicking buttons", async () => {
            const tagsMap: ResourceTagsMap = {
                file1: [{ key: "city", value: "augsburg" }]
            };

            render(
                <FilezProvider>
                    <ResourceTags tagsMap={tagsMap} resourceType={mockResourceType} />
                </FilezProvider>
            );

            // Wait for FilezProvider to load
            await waitFor(() => {
                expect(screen.getByTitle("Text")).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTitle("Text"));
            expect(screen.getByRole("textbox")).toBeInTheDocument();

            fireEvent.click(screen.getByTitle("Badges"));
            expect(screen.getByText("city=augsburg")).toBeInTheDocument();
        });

        it("displays correct text in textarea for single resource", async () => {
            const tagsMap: ResourceTagsMap = {
                file1: [
                    { key: "city", value: "augsburg" },
                    { key: "country", value: "germany" }
                ]
            };

            render(
                <FilezProvider>
                    <ResourceTags tagsMap={tagsMap} resourceType={mockResourceType} />
                </FilezProvider>
            );

            // Wait for FilezProvider to load
            await waitFor(() => {
                expect(screen.getByTitle("Text")).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTitle("Text"));
            const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
            expect(textarea.value).toBe("city=augsburg, country=germany");
        });

        it("updates textarea value when tagsMap prop changes", async () => {
            const initialTagsMap: ResourceTagsMap = {
                file1: [{ key: "city", value: "augsburg" }]
            };

            const { rerender } = render(
                <FilezProvider>
                    <ResourceTags tagsMap={initialTagsMap} resourceType={mockResourceType} />
                </FilezProvider>
            );

            // Wait for FilezProvider to load
            await waitFor(() => {
                expect(screen.getByTitle("Text")).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTitle("Text"));
            let textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
            expect(textarea.value).toBe("city=augsburg");

            const updatedTagsMap: ResourceTagsMap = {
                file1: [{ key: "city", value: "berlin" }]
            };

            rerender(
                <FilezProvider>
                    <ResourceTags tagsMap={updatedTagsMap} resourceType={mockResourceType} />
                </FilezProvider>
            );

            textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
            expect(textarea.value).toBe("city=berlin");
        });
    });

    describe("badge interactions", () => {
        it("shows 'Add to all' button for tags not assigned to all resources", async () => {
            const tagsMap: ResourceTagsMap = {
                file1: [{ key: "city", value: "augsburg" }],
                file2: [{ key: "city", value: "münchen" }]
            };

            render(
                <FilezProvider>
                    <ResourceTags tagsMap={tagsMap} resourceType={mockResourceType} />
                </FilezProvider>
            );

            // Wait for FilezProvider to load
            await waitFor(() => {
                expect(document.querySelectorAll(".TagAddToAll")).toHaveLength(2);
            });
            expect(document.querySelectorAll(".TagRemoveFromAll")).toHaveLength(2);
        });

        it("does not show 'Add to all' button for tags assigned to all resources", async () => {
            const tagsMap: ResourceTagsMap = {
                file1: [{ key: "city", value: "augsburg" }],
                file2: [{ key: "city", value: "augsburg" }]
            };

            render(
                <FilezProvider>
                    <ResourceTags tagsMap={tagsMap} resourceType={mockResourceType} />
                </FilezProvider>
            );

            // Wait for FilezProvider to load
            await waitFor(() => {
                expect(document.querySelector(".TagAddToAll")).not.toBeInTheDocument();
            });
            expect(document.querySelectorAll(".TagRemoveFromAll")).toHaveLength(1);
        });

        it("calls onCommit when 'Add to all' button is clicked", async () => {
            const mockOnCommit = vi.fn();
            const tagsMap: ResourceTagsMap = {
                file1: [{ key: "city", value: "augsburg" }],
                file2: [{ key: "city", value: "münchen" }]
            };

            render(
                <FilezProvider>
                    <ResourceTags
                        tagsMap={tagsMap}
                        resourceType={mockResourceType}
                        onCommit={mockOnCommit}
                    />
                </FilezProvider>
            );

            // Wait for FilezProvider to load
            await waitFor(() => {
                expect(document.querySelectorAll(".TagAddToAll")).toHaveLength(2);
            });

            const addToAllButtons = document.querySelectorAll(".TagAddToAll");
            fireEvent.click(addToAllButtons[0] as HTMLElement);

            expect(mockOnCommit).toHaveBeenCalledWith(
                expect.objectContaining({
                    resourceType: mockResourceType,
                    add: expect.arrayContaining([{ key: "city", value: "augsburg" }])
                })
            );
        });

        it("calls onCommit when 'Remove from all' button is clicked", async () => {
            const mockOnCommit = vi.fn();
            const tagsMap: ResourceTagsMap = {
                file1: [{ key: "city", value: "augsburg" }]
            };

            render(
                <FilezProvider>
                    <ResourceTags
                        tagsMap={tagsMap}
                        resourceType={mockResourceType}
                        onCommit={mockOnCommit}
                    />
                </FilezProvider>
            );

            // Wait for FilezProvider to load
            await waitFor(() => {
                expect(document.querySelector(".TagRemoveFromAll")).toBeInTheDocument();
            });

            fireEvent.click(document.querySelector(".TagRemoveFromAll") as HTMLElement);

            expect(mockOnCommit).toHaveBeenCalledWith(
                expect.objectContaining({
                    resourceType: mockResourceType,
                    remove: expect.arrayContaining([{ key: "city", value: "augsburg" }])
                })
            );
        });
    });

    describe("search functionality", () => {
        it("shows search input only in badges mode", async () => {
            const tagsMap: ResourceTagsMap = {
                file1: [{ key: "city", value: "augsburg" }]
            };

            render(
                <FilezProvider>
                    <ResourceTags tagsMap={tagsMap} resourceType={mockResourceType} />
                </FilezProvider>
            );

            // Wait for FilezProvider to load
            await waitFor(() => {
                expect(screen.getByPlaceholderText("Search tags...")).toBeInTheDocument();
            });

            // Switch to text mode and search should disappear
            fireEvent.click(screen.getByTitle("Text"));
            expect(screen.queryByPlaceholderText("Search tags...")).not.toBeInTheDocument();

            // Switch back to badges mode and search should appear
            fireEvent.click(screen.getByTitle("Badges"));
            expect(screen.getByPlaceholderText("Search tags...")).toBeInTheDocument();
        });

        it("mutes non-matching tags based on search term", async () => {
            const tagsMap: ResourceTagsMap = {
                file1: [
                    { key: "city", value: "augsburg" },
                    { key: "country", value: "germany" },
                    { key: "type", value: "document" }
                ]
            };

            render(
                <FilezProvider>
                    <ResourceTags tagsMap={tagsMap} resourceType={mockResourceType} />
                </FilezProvider>
            );

            // Wait for FilezProvider to load
            await waitFor(() => {
                expect(screen.getByText("city=augsburg")).toBeInTheDocument();
                expect(screen.getByText("country=germany")).toBeInTheDocument();
                expect(screen.getByText("type=document")).toBeInTheDocument();
            });

            // Search for "city" - should mute non-matching tags
            const searchInput = screen.getByPlaceholderText("Search tags...");
            fireEvent.change(searchInput, { target: { value: "city" } });

            await waitFor(() => {
                // All tags should still be in document, but non-matching ones should be muted
                expect(screen.getByText("city=augsburg")).toBeInTheDocument();
                expect(screen.getByText("country=germany")).toBeInTheDocument();
                expect(screen.getByText("type=document")).toBeInTheDocument();

                // Check that matching tag is not muted (no opacity-30 class)
                const cityTag = screen.getByText("city=augsburg").closest(".border");
                expect(cityTag).not.toHaveClass("opacity-30");

                // Check that non-matching tags are muted (have opacity-30 class)
                const countryTag = screen.getByText("country=germany").closest(".border");
                const typeTag = screen.getByText("type=document").closest(".border");
                expect(countryTag).toHaveClass("opacity-30");
                expect(typeTag).toHaveClass("opacity-30");
            });
        });

        it("mutes tags based on value search", async () => {
            const tagsMap: ResourceTagsMap = {
                file1: [
                    { key: "city", value: "augsburg" },
                    { key: "country", value: "germany" },
                    { key: "type", value: "document" }
                ]
            };

            render(
                <FilezProvider>
                    <ResourceTags tagsMap={tagsMap} resourceType={mockResourceType} />
                </FilezProvider>
            );

            // Wait for FilezProvider to load
            await waitFor(() => {
                expect(screen.getByText("city=augsburg")).toBeInTheDocument();
            });

            // Search for "germany" - should mute non-matching tags
            const searchInput = screen.getByPlaceholderText("Search tags...");
            fireEvent.change(searchInput, { target: { value: "germany" } });

            await waitFor(() => {
                // All tags should still be in document
                expect(screen.getByText("country=germany")).toBeInTheDocument();
                expect(screen.getByText("city=augsburg")).toBeInTheDocument();
                expect(screen.getByText("type=document")).toBeInTheDocument();

                // Check that matching tag is not muted
                const countryTag = screen.getByText("country=germany").closest(".border");
                expect(countryTag).not.toHaveClass("opacity-30");

                // Check that non-matching tags are muted
                const cityTag = screen.getByText("city=augsburg").closest(".border");
                const typeTag = screen.getByText("type=document").closest(".border");
                expect(cityTag).toHaveClass("opacity-30");
                expect(typeTag).toHaveClass("opacity-30");
            });
        });

        it("shows all tags when search is empty", async () => {
            const tagsMap: ResourceTagsMap = {
                file1: [
                    { key: "city", value: "augsburg" },
                    { key: "country", value: "germany" }
                ]
            };

            render(
                <FilezProvider>
                    <ResourceTags tagsMap={tagsMap} resourceType={mockResourceType} />
                </FilezProvider>
            );

            // Wait for FilezProvider to load
            await waitFor(() => {
                expect(screen.getByText("city=augsburg")).toBeInTheDocument();
                expect(screen.getByText("country=germany")).toBeInTheDocument();
            });

            const searchInput = screen.getByPlaceholderText("Search tags...");

            // Search for something
            fireEvent.change(searchInput, { target: { value: "city" } });
            await waitFor(() => {
                // Country tag should be muted when searching for "city"
                const countryTag = screen.getByText("country=germany").closest(".border");
                expect(countryTag).toHaveClass("opacity-30");
            });

            // Clear search
            fireEvent.change(searchInput, { target: { value: "" } });
            await waitFor(() => {
                expect(screen.getByText("city=augsburg")).toBeInTheDocument();
                expect(screen.getByText("country=germany")).toBeInTheDocument();

                // Both tags should be visible (not muted) when search is empty
                const cityTag = screen.getByText("city=augsburg").closest(".border");
                const countryTag = screen.getByText("country=germany").closest(".border");
                expect(cityTag).not.toHaveClass("opacity-30");
                expect(countryTag).not.toHaveClass("opacity-30");
            });
        });

        it("search is case insensitive", async () => {
            const tagsMap: ResourceTagsMap = {
                file1: [
                    { key: "City", value: "Augsburg" },
                    { key: "Country", value: "Germany" }
                ]
            };

            render(
                <FilezProvider>
                    <ResourceTags tagsMap={tagsMap} resourceType={mockResourceType} />
                </FilezProvider>
            );

            // Wait for FilezProvider to load
            await waitFor(() => {
                expect(screen.getByText("City=Augsburg")).toBeInTheDocument();
            });

            const searchInput = screen.getByPlaceholderText("Search tags...");

            // Search with lowercase
            fireEvent.change(searchInput, { target: { value: "city" } });
            await waitFor(() => {
                // Both tags should still be in document
                expect(screen.getByText("City=Augsburg")).toBeInTheDocument();
                expect(screen.getByText("Country=Germany")).toBeInTheDocument();

                // City tag should not be muted, Country tag should be muted
                const cityTag = screen.getByText("City=Augsburg").closest(".border");
                const countryTag = screen.getByText("Country=Germany").closest(".border");
                expect(cityTag).not.toHaveClass("opacity-30");
                expect(countryTag).toHaveClass("opacity-30");
            });

            // Search with uppercase
            fireEvent.change(searchInput, { target: { value: "GERMANY" } });
            await waitFor(() => {
                // Both tags should still be in document
                expect(screen.getByText("Country=Germany")).toBeInTheDocument();
                expect(screen.getByText("City=Augsburg")).toBeInTheDocument();

                // Country tag should not be muted, City tag should be muted
                const cityTag = screen.getByText("City=Augsburg").closest(".border");
                const countryTag = screen.getByText("Country=Germany").closest(".border");
                expect(countryTag).not.toHaveClass("opacity-30");
                expect(cityTag).toHaveClass("opacity-30");
            });
        });

        it("shows clear button when search has text and clears search when clicked", async () => {
            const tagsMap: ResourceTagsMap = {
                file1: [
                    { key: "city", value: "augsburg" },
                    { key: "country", value: "germany" }
                ]
            };

            render(
                <FilezProvider>
                    <ResourceTags tagsMap={tagsMap} resourceType={mockResourceType} />
                </FilezProvider>
            );

            // Wait for FilezProvider to load
            await waitFor(() => {
                expect(screen.getByPlaceholderText("Search tags...")).toBeInTheDocument();
            });

            const searchInput = screen.getByPlaceholderText("Search tags...");

            // Initially no clear button should be visible
            expect(screen.queryByTitle("Clear search")).not.toBeInTheDocument();

            // Type in search
            fireEvent.change(searchInput, { target: { value: "city" } });

            // Clear button should appear
            await waitFor(() => {
                expect(screen.getByTitle("Clear search")).toBeInTheDocument();
            });

            // Click clear button
            fireEvent.click(screen.getByTitle("Clear search"));

            // Search should be cleared
            await waitFor(() => {
                expect(searchInput).toHaveValue("");
                expect(screen.queryByTitle("Clear search")).not.toBeInTheDocument();

                // All tags should be visible (not muted) after clearing
                const cityTag = screen.getByText("city=augsburg").closest(".border");
                const countryTag = screen.getByText("country=germany").closest(".border");
                expect(cityTag).not.toHaveClass("opacity-30");
                expect(countryTag).not.toHaveClass("opacity-30");
            });
        });
    });

    describe("backend search functionality", () => {
        const mockSearchHandler = vi.fn();

        beforeEach(() => {
            mockSearchHandler.mockClear();
        });

        it("calls searchHandler when typing in search field", async () => {
            const tagsMap: ResourceTagsMap = {
                file1: [{ key: "city", value: "augsburg" }]
            };

            const searchResponse: TagSearchResponse = {
                tags: [
                    { key: "city", value: "berlin", usageCount: 5 },
                    { key: "country", value: "france", usageCount: 3 }
                ]
            };

            mockSearchHandler.mockReturnValue(searchResponse);

            render(
                <FilezProvider>
                    <ResourceTags
                        tagsMap={tagsMap}
                        resourceType={mockResourceType}
                        searchHandler={mockSearchHandler}
                    />
                </FilezProvider>
            );

            // Wait for FilezProvider to load
            await waitFor(() => {
                expect(screen.getByPlaceholderText("Search tags...")).toBeInTheDocument();
            });

            const searchInput = screen.getByPlaceholderText("Search tags...");

            // Type in search
            fireEvent.change(searchInput, { target: { value: "ber" } });

            // Wait for debounced search call
            await waitFor(
                () => {
                    expect(mockSearchHandler).toHaveBeenCalledWith({
                        searchTerm: "ber",
                        resourceType: mockResourceType,
                        resourceIds: ["file1"]
                    });
                },
                { timeout: 500 }
            );
        });

        it("displays search results dropdown when results are available", async () => {
            const tagsMap: ResourceTagsMap = {
                file1: [{ key: "city", value: "augsburg" }]
            };

            const searchResponse: TagSearchResponse = {
                tags: [
                    { key: "city", value: "berlin", usageCount: 5 },
                    { key: "country", value: "france", usageCount: 3 }
                ]
            };

            mockSearchHandler.mockReturnValue(searchResponse);

            render(
                <FilezProvider>
                    <ResourceTags
                        tagsMap={tagsMap}
                        resourceType={mockResourceType}
                        searchHandler={mockSearchHandler}
                    />
                </FilezProvider>
            );

            // Wait for FilezProvider to load
            await waitFor(() => {
                expect(screen.getByPlaceholderText("Search tags...")).toBeInTheDocument();
            });

            const searchInput = screen.getByPlaceholderText("Search tags...");

            // Type in search
            fireEvent.change(searchInput, { target: { value: "ber" } });

            // Wait for search results to appear
            await waitFor(
                () => {
                    expect(screen.getByText("city=berlin")).toBeInTheDocument();
                    expect(screen.getByText("country=france")).toBeInTheDocument();
                    expect(screen.getByText("5")).toBeInTheDocument(); // usage count
                    expect(screen.getByText("3")).toBeInTheDocument(); // usage count
                },
                { timeout: 500 }
            );
        });

        it("adds tag when search result is clicked", async () => {
            const mockOnCommit = vi.fn();
            const tagsMap: ResourceTagsMap = {
                file1: [{ key: "city", value: "augsburg" }]
            };

            const searchResponse: TagSearchResponse = {
                tags: [{ key: "country", value: "germany", usageCount: 10 }]
            };

            mockSearchHandler.mockReturnValue(searchResponse);

            render(
                <FilezProvider>
                    <ResourceTags
                        tagsMap={tagsMap}
                        resourceType={mockResourceType}
                        searchHandler={mockSearchHandler}
                        onCommit={mockOnCommit}
                    />
                </FilezProvider>
            );

            // Wait for FilezProvider to load
            await waitFor(() => {
                expect(screen.getByPlaceholderText("Search tags...")).toBeInTheDocument();
            });

            const searchInput = screen.getByPlaceholderText("Search tags...");

            // Type in search
            fireEvent.change(searchInput, { target: { value: "ger" } });

            // Wait for search results and click on the result
            await waitFor(
                () => {
                    const searchResult = screen.getByText("country=germany");
                    fireEvent.click(searchResult);
                },
                { timeout: 500 }
            );

            // Verify onCommit was called with the new tag
            await waitFor(() => {
                expect(mockOnCommit).toHaveBeenCalledWith(
                    expect.objectContaining({
                        add: expect.arrayContaining([{ key: "country", value: "germany" }])
                    })
                );
            });

            // Search should be cleared after selection
            expect(searchInput).toHaveValue("");
        });

        it("does not show search results when searchHandler is not provided", async () => {
            const tagsMap: ResourceTagsMap = {
                file1: [{ key: "city", value: "augsburg" }]
            };

            render(
                <FilezProvider>
                    <ResourceTags
                        tagsMap={tagsMap}
                        resourceType={mockResourceType}
                        // No searchHandler provided
                    />
                </FilezProvider>
            );

            // Wait for FilezProvider to load
            await waitFor(() => {
                expect(screen.getByPlaceholderText("Search tags...")).toBeInTheDocument();
            });

            const searchInput = screen.getByPlaceholderText("Search tags...");

            // Type in search
            fireEvent.change(searchInput, { target: { value: "test" } });

            // Wait a bit and verify no dropdown appears
            await new Promise((resolve) => setTimeout(resolve, 400));

            // Should not show any search results
            expect(screen.queryByText(/test/)).not.toBeInTheDocument();
        });

        it("clears search results when search is cleared", async () => {
            const tagsMap: ResourceTagsMap = {
                file1: [{ key: "city", value: "augsburg" }]
            };

            const searchResponse: TagSearchResponse = {
                tags: [{ key: "city", value: "berlin", usageCount: 5 }]
            };

            mockSearchHandler.mockReturnValue(searchResponse);

            render(
                <FilezProvider>
                    <ResourceTags
                        tagsMap={tagsMap}
                        resourceType={mockResourceType}
                        searchHandler={mockSearchHandler}
                    />
                </FilezProvider>
            );

            // Wait for FilezProvider to load
            await waitFor(() => {
                expect(screen.getByPlaceholderText("Search tags...")).toBeInTheDocument();
            });

            const searchInput = screen.getByPlaceholderText("Search tags...");

            // Type in search
            fireEvent.change(searchInput, { target: { value: "ber" } });

            // Wait for search results to appear
            await waitFor(
                () => {
                    expect(screen.getByText("city=berlin")).toBeInTheDocument();
                },
                { timeout: 500 }
            );

            // Clear search using the clear button
            fireEvent.click(screen.getByTitle("Clear search"));

            // Search results should disappear
            await waitFor(() => {
                expect(screen.queryByText("city=berlin")).not.toBeInTheDocument();
            });
        });
    });
});

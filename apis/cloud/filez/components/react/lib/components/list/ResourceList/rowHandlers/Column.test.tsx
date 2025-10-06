import { FilezProvider } from "@/main";
import { render, screen, waitFor } from "@testing-library/react";
import { SortDirection } from "filez-client-typescript";
import { describe, expect, test, vi } from "vitest";
import ResourceList from "../ResourceList";
import { type BaseResource } from "../ResourceListTypes";
import ColumnListRowHandler, { type Column } from "./Column";

// Mock test resource type
interface TestResource extends BaseResource {
    id: string;
    name: string;
    size: number;
    type: string;
    dateModified: string;
    created_time: string;
    modified_time: string;
}

// Helper function to create test data
const createTestResources = (count: number): TestResource[] => {
    return Array.from({ length: count }, (_, i) => ({
        id: `resource-${i}`,
        name: `Test Resource ${i + 1}`,
        size: (i + 1) * 1000,
        type: i % 2 === 0 ? "file" : "folder",
        dateModified: new Date(2024, 0, i + 1).toISOString(),
        created_time: new Date(2024, 0, i + 1).toISOString(),
        modified_time: new Date(2024, 0, i + 1).toISOString()
    }));
};

// Helper function to create test columns
const createTestColumns = (): Column<TestResource>[] => [
    {
        field: "name",
        label: "Name",
        direction: SortDirection.Ascending,
        widthPercent: 40,
        minWidthPixels: 200,
        enabled: true,
        render: (item) => <span>{item.name}</span>
    },
    {
        field: "size",
        label: "Size",
        direction: SortDirection.Neutral,
        widthPercent: 20,
        minWidthPixels: 100,
        enabled: true,
        render: (item) => <span>{item.size} bytes</span>
    },
    {
        field: "type",
        label: "Type",
        direction: SortDirection.Neutral,
        widthPercent: 20,
        minWidthPixels: 100,
        enabled: true,
        render: (item) => <span>{item.type}</span>
    },
    {
        field: "dateModified",
        label: "Date Modified",
        direction: SortDirection.Neutral,
        widthPercent: 20,
        minWidthPixels: 150,
        enabled: false, // Test disabled column
        render: (item) => <span>{new Date(item.dateModified).toLocaleDateString()}</span>
    }
];

describe("ColumnListRowHandler via ResourceList Integration", () => {
    describe("Configuration Options", () => {
        test("disableColumnResizing: false - should show resizable handles", async () => {
            const testResources = createTestResources(3);
            const columns = createTestColumns();

            const mockGetResourcesList = vi.fn().mockResolvedValue({
                items: testResources,
                totalCount: testResources.length
            });

            const columnHandler = new ColumnListRowHandler({
                columns,
                disableColumnResizing: false,
                hideColumnHeader: false,
                hideSelectionCheckboxColumn: true
            });

            const { container } = render(
                <div style={{ width: 800, height: 600 }}>
                    <FilezProvider>
                        <ResourceList<TestResource>
                            resourceType="TestResource"
                            defaultSortBy="name"
                            defaultSortDirection={SortDirection.Ascending}
                            initialRowHandler="ColumnListRowHandler"
                            getResourcesList={mockGetResourcesList}
                            rowHandlers={[columnHandler]}
                        />
                    </FilezProvider>
                </div>
            );

            // Wait for ResourceList to load
            await waitFor(
                () => {
                    expect(mockGetResourcesList).toHaveBeenCalled();
                    expect(screen.getByText("Name")).toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            // ResizableHandle should be present when resizing is enabled
            const resizableElements = document.querySelectorAll(
                '[data-panel-resize-handle-enabled="true"]'
            );
            expect(resizableElements.length).toBeGreaterThan(0);
        });

        test("disableColumnResizing: true - should hide resizable handles", async () => {
            const testResources = createTestResources(3);
            const columns = createTestColumns();

            const mockGetResourcesList = vi.fn().mockResolvedValue({
                items: testResources,
                totalCount: testResources.length
            });

            const columnHandler = new ColumnListRowHandler({
                columns,
                disableColumnResizing: true,
                hideColumnHeader: false,
                hideSelectionCheckboxColumn: true
            });

            const { container } = render(
                <div style={{ width: 800, height: 600 }}>
                    <FilezProvider>
                        <ResourceList<TestResource>
                            resourceType="TestResource"
                            defaultSortBy="name"
                            defaultSortDirection={SortDirection.Ascending}
                            initialRowHandler="ColumnListRowHandler"
                            getResourcesList={mockGetResourcesList}
                            rowHandlers={[columnHandler]}
                        />
                    </FilezProvider>
                </div>
            );

            // Wait for ResourceList to load
            await waitFor(
                () => {
                    expect(mockGetResourcesList).toHaveBeenCalled();
                    expect(screen.getByText("Name")).toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            // ResizableHandle should not be present when resizing is disabled
            const resizableElements = document.querySelectorAll(
                '[data-panel-resize-handle-enabled="true"]'
            );
            expect(resizableElements.length).toBe(0);
        });

        test("disableColumnSorting: true - should disable column sorting", async () => {
            const testResources = createTestResources(3);
            const columns = createTestColumns();

            const mockGetResourcesList = vi.fn().mockResolvedValue({
                items: testResources,
                totalCount: testResources.length
            });

            const columnHandler = new ColumnListRowHandler({
                columns,
                disableColumnSorting: true,
                hideColumnHeader: false,
                hideColumnPicker: true,
                hideSelectionCheckboxColumn: true
            });

            const { container } = render(
                <div style={{ width: 800, height: 600 }}>
                    <FilezProvider>
                        <ResourceList<TestResource>
                            resourceType="TestResource"
                            defaultSortBy="name"
                            defaultSortDirection={SortDirection.Ascending}
                            initialRowHandler="ColumnListRowHandler"
                            getResourcesList={mockGetResourcesList}
                            rowHandlers={[columnHandler]}
                        />
                    </FilezProvider>
                </div>
            );

            // Wait for ResourceList to load
            await waitFor(
                () => {
                    expect(mockGetResourcesList).toHaveBeenCalled();
                    expect(screen.getByText("Name")).toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            // Find column headers
            const nameColumn = screen.getByText("Name");
            const sizeColumn = screen.getByText("Size");

            // Check that columns have cursor-default class (not clickable)
            expect(nameColumn.closest("span")).toHaveClass("cursor-default");
            expect(sizeColumn.closest("span")).toHaveClass("cursor-default");

            // No sort icons should be displayed
            const sortIcons = document.querySelectorAll(
                'svg[class*="chevron"], svg[class*="Chevron"]'
            );
            expect(sortIcons.length).toBe(0);
        });

        test("disableColumnSorting: false - should enable column sorting", async () => {
            const testResources = createTestResources(3);
            const columns = createTestColumns();

            const mockGetResourcesList = vi.fn().mockResolvedValue({
                items: testResources,
                totalCount: testResources.length
            });

            const columnHandler = new ColumnListRowHandler({
                columns,
                disableColumnSorting: false,
                hideColumnHeader: false,
                hideColumnPicker: true,
                hideSelectionCheckboxColumn: true
            });

            const { container } = render(
                <div style={{ width: 800, height: 600 }}>
                    <FilezProvider>
                        <ResourceList<TestResource>
                            resourceType="TestResource"
                            defaultSortBy="name"
                            defaultSortDirection={SortDirection.Ascending}
                            initialRowHandler="ColumnListRowHandler"
                            getResourcesList={mockGetResourcesList}
                            rowHandlers={[columnHandler]}
                        />
                    </FilezProvider>
                </div>
            );

            // Wait for ResourceList to load
            await waitFor(
                () => {
                    expect(mockGetResourcesList).toHaveBeenCalled();
                    expect(screen.getByText("Name")).toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            // Find column headers
            const nameColumn = screen.getByText("Name");
            const sizeColumn = screen.getByText("Size");

            // Check that columns have cursor-pointer class (clickable)
            expect(nameColumn.closest("span")).toHaveClass("cursor-pointer");
            expect(sizeColumn.closest("span")).toHaveClass("cursor-pointer");

            // Sort icon should be present for ascending column (Name has SortDirection.Ascending)
            const sortIcons = document.querySelectorAll("svg");
            expect(sortIcons.length).toBeGreaterThan(0);
        });

        test("hideColumnPicker: true - should hide column picker", async () => {
            const testResources = createTestResources(3);
            const columns = createTestColumns();

            const mockGetResourcesList = vi.fn().mockResolvedValue({
                items: testResources,
                totalCount: testResources.length
            });

            const columnHandler = new ColumnListRowHandler({
                columns,
                hideColumnPicker: true,
                hideColumnHeader: false,
                hideSelectionCheckboxColumn: true
            });

            const { container } = render(
                <div style={{ width: 800, height: 600 }}>
                    <FilezProvider>
                        <ResourceList<TestResource>
                            resourceType="TestResource"
                            defaultSortBy="name"
                            defaultSortDirection={SortDirection.Ascending}
                            initialRowHandler="ColumnListRowHandler"
                            getResourcesList={mockGetResourcesList}
                            rowHandlers={[columnHandler]}
                        />
                    </FilezProvider>
                </div>
            );

            // Wait for ResourceList to load
            await waitFor(
                () => {
                    expect(mockGetResourcesList).toHaveBeenCalled();
                    expect(screen.getByText("Name")).toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            // Column picker should not be present
            const absoluteElements = document.querySelectorAll(".absolute");
            // Should not find absolute positioned column picker
            expect(absoluteElements.length).toBe(0);
        });

        test("hideColumnPicker: false - should show column picker", async () => {
            const testResources = createTestResources(3);
            const columns = createTestColumns();

            const mockGetResourcesList = vi.fn().mockResolvedValue({
                items: testResources,
                totalCount: testResources.length
            });

            const columnHandler = new ColumnListRowHandler({
                columns,
                hideColumnPicker: false,
                hideColumnHeader: false,
                hideSelectionCheckboxColumn: true
            });

            const { container } = render(
                <div style={{ width: 800, height: 600 }}>
                    <FilezProvider>
                        <ResourceList<TestResource>
                            resourceType="TestResource"
                            defaultSortBy="name"
                            defaultSortDirection={SortDirection.Ascending}
                            initialRowHandler="ColumnListRowHandler"
                            getResourcesList={mockGetResourcesList}
                            rowHandlers={[columnHandler]}
                        />
                    </FilezProvider>
                </div>
            );

            // Wait for ResourceList to load
            await waitFor(
                () => {
                    expect(mockGetResourcesList).toHaveBeenCalled();
                    expect(screen.getByText("Name")).toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            // OptionPicker should be rendered (absolute positioned element)
            const absoluteElement = document.querySelector(".absolute");
            expect(absoluteElement).toBeTruthy();
        });

        test("hideColumnHeader: true - should hide entire header", async () => {
            const testResources = createTestResources(3);
            const columns = createTestColumns();

            const mockGetResourcesList = vi.fn().mockResolvedValue({
                items: testResources,
                totalCount: testResources.length
            });

            const columnHandler = new ColumnListRowHandler({
                columns,
                hideColumnHeader: true,
                hideSelectionCheckboxColumn: true
            });

            const { container } = render(
                <div style={{ width: 800, height: 600 }}>
                    <FilezProvider>
                        <ResourceList<TestResource>
                            resourceType="TestResource"
                            defaultSortBy="name"
                            defaultSortDirection={SortDirection.Ascending}
                            initialRowHandler="ColumnListRowHandler"
                            getResourcesList={mockGetResourcesList}
                            rowHandlers={[columnHandler]}
                        />
                    </FilezProvider>
                </div>
            );

            // Wait for ResourceList to load
            await waitFor(
                () => {
                    expect(mockGetResourcesList).toHaveBeenCalled();
                },
                { timeout: 3000 }
            );

            // Verify component structure is rendered
            expect(container.querySelector(".ResourceList")).toBeInTheDocument();

            // Column headers should not be visible
            expect(screen.queryByText("Name")).not.toBeInTheDocument();
            expect(screen.queryByText("Size")).not.toBeInTheDocument();
            expect(screen.queryByText("Type")).not.toBeInTheDocument();
        });

        test("hideColumnHeader: false - should show header", async () => {
            const testResources = createTestResources(3);
            const columns = createTestColumns();

            const mockGetResourcesList = vi.fn().mockResolvedValue({
                items: testResources,
                totalCount: testResources.length
            });

            const columnHandler = new ColumnListRowHandler({
                columns,
                hideColumnHeader: false,
                hideSelectionCheckboxColumn: true
            });

            const { container } = render(
                <div style={{ width: 800, height: 600 }}>
                    <FilezProvider>
                        <ResourceList<TestResource>
                            resourceType="TestResource"
                            defaultSortBy="name"
                            defaultSortDirection={SortDirection.Ascending}
                            initialRowHandler="ColumnListRowHandler"
                            getResourcesList={mockGetResourcesList}
                            rowHandlers={[columnHandler]}
                        />
                    </FilezProvider>
                </div>
            );

            // Wait for ResourceList to load
            await waitFor(
                () => {
                    expect(mockGetResourcesList).toHaveBeenCalled();
                    expect(screen.getByText("Name")).toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            // Column headers should be visible
            expect(screen.getByText("Name")).toBeInTheDocument();
            expect(screen.getByText("Size")).toBeInTheDocument();
            expect(screen.getByText("Type")).toBeInTheDocument();
        });

        test("hideSelectionColumn: true - should hide selection checkboxes", async () => {
            const testResources = createTestResources(3);
            const columns = createTestColumns();

            const mockGetResourcesList = vi.fn().mockResolvedValue({
                items: testResources,
                totalCount: testResources.length
            });

            const columnHandler = new ColumnListRowHandler({
                columns,
                hideSelectionCheckboxColumn: true,
                hideColumnHeader: false
            });

            const { container } = render(
                <div style={{ width: 800, height: 600 }}>
                    <FilezProvider>
                        <ResourceList<TestResource>
                            resourceType="TestResource"
                            defaultSortBy="name"
                            defaultSortDirection={SortDirection.Ascending}
                            initialRowHandler="ColumnListRowHandler"
                            getResourcesList={mockGetResourcesList}
                            rowHandlers={[columnHandler]}
                        />
                    </FilezProvider>
                </div>
            );

            // Wait for ResourceList to load
            await waitFor(
                () => {
                    expect(mockGetResourcesList).toHaveBeenCalled();
                    expect(screen.getByText("Name")).toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            // No checkboxes should be present
            const checkboxes = screen.queryAllByRole("checkbox");
            expect(checkboxes.length).toBe(0);
        });

        test("hideSelectionColumn: false - should show selection checkboxes", async () => {
            const testResources = createTestResources(3);
            const columns = createTestColumns();

            const mockGetResourcesList = vi.fn().mockResolvedValue({
                items: testResources,
                totalCount: testResources.length
            });

            const columnHandler = new ColumnListRowHandler({
                columns,
                hideSelectionCheckboxColumn: false,
                hideColumnHeader: false
            });

            const { container } = render(
                <div style={{ width: 800, height: 600 }}>
                    <FilezProvider>
                        <ResourceList<TestResource>
                            resourceType="TestResource"
                            defaultSortBy="name"
                            defaultSortDirection={SortDirection.Ascending}
                            initialRowHandler="ColumnListRowHandler"
                            getResourcesList={mockGetResourcesList}
                            rowHandlers={[columnHandler]}
                        />
                    </FilezProvider>
                </div>
            );

            // Wait for ResourceList to load
            await waitFor(
                () => {
                    expect(mockGetResourcesList).toHaveBeenCalled();
                    expect(screen.getByText("Name")).toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            // Header checkbox should be present
            const checkboxes = screen.getAllByRole("checkbox");
            expect(checkboxes.length).toBeGreaterThan(0);
        });
    });

    describe("Column Sorting Functionality via ResourceList", () => {
        test("clicking column header should trigger sort and API call", async () => {
            const testResources = createTestResources(3);
            const columns = createTestColumns();

            const mockGetResourcesList = vi
                .fn()
                .mockResolvedValueOnce({
                    items: testResources,
                    totalCount: testResources.length
                })
                .mockResolvedValueOnce({
                    items: testResources.reverse(), // Simulated sorted result
                    totalCount: testResources.length
                });

            const columnHandler = new ColumnListRowHandler({
                columns,
                disableColumnSorting: false,
                hideColumnHeader: false,
                hideSelectionCheckboxColumn: true
            });

            render(
                <div style={{ width: 800, height: 600 }}>
                    <FilezProvider>
                        <ResourceList<TestResource>
                            resourceType="TestResource"
                            defaultSortBy="name"
                            defaultSortDirection={SortDirection.Ascending}
                            initialRowHandler="ColumnListRowHandler"
                            getResourcesList={mockGetResourcesList}
                            rowHandlers={[columnHandler]}
                        />
                    </FilezProvider>
                </div>
            );

            // Wait for initial load
            await waitFor(
                () => {
                    expect(mockGetResourcesList).toHaveBeenCalledTimes(1);
                    expect(screen.getByText("Size")).toBeInTheDocument();
                },
                { timeout: 3000 }
            );

            // Verify initial API call parameters
            expect(mockGetResourcesList).toHaveBeenCalledWith(
                expect.objectContaining({
                    sortBy: "name",
                    sortDirection: SortDirection.Ascending
                })
            );

            // Simulate sorting change by calling the column handler's sort method
            columnHandler.setColumSorting("size", SortDirection.Descending);

            // Wait for the sort change to trigger a new API call
            await waitFor(
                () => {
                    expect(mockGetResourcesList).toHaveBeenCalledTimes(2);
                },
                { timeout: 3000 }
            );

            // Verify the new API call has updated sort parameters
            expect(mockGetResourcesList).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    sortBy: "size",
                    sortDirection: SortDirection.Descending
                })
            );
        });

        test("column sorting callback works correctly", () => {
            const columns = createTestColumns();

            const columnHandler = new ColumnListRowHandler({
                columns,
                hideSelectionCheckboxColumn: true
            });

            // Mock the resource list to test the callback
            const mockResourceList = {
                setState: vi.fn(),
                loadItems: vi.fn(),
                forceUpdate: vi.fn()
            };

            columnHandler.resourceList = mockResourceList as any;

            // Test setting column sorting
            columnHandler.setColumSorting("size", SortDirection.Ascending);

            // Check that the column direction was updated
            const sizeColumn = columnHandler.columns.find((c) => c.field === "size");
            expect(sizeColumn?.direction).toBe(SortDirection.Ascending);

            // Check that other columns were reset to Neutral
            const nameColumn = columnHandler.columns.find((c) => c.field === "name");
            expect(nameColumn?.direction).toBe(SortDirection.Neutral);

            // Check that the resource list setState was called
            expect(mockResourceList.setState).toHaveBeenCalledWith(
                {
                    sortBy: "size",
                    sortDirection: SortDirection.Ascending
                },
                expect.any(Function)
            );
        });
    });

    describe("Constructor and Props", () => {
        test("should use provided rowHeightPixels", () => {
            const columns = createTestColumns();
            const columnHandler = new ColumnListRowHandler({
                columns,
                rowHeightPixels: 48
            });

            expect(columnHandler.rowHeightPixels).toBe(48);
        });

        test("should use default rowHeightPixels when not provided", () => {
            const columns = createTestColumns();
            const columnHandler = new ColumnListRowHandler({
                columns
            });

            expect(columnHandler.rowHeightPixels).toBe(24);
        });
    });

    describe("API Integration", () => {
        test("should call API with correct initial parameters", async () => {
            const testResources = createTestResources(3);
            const columns = createTestColumns();

            const mockGetResourcesList = vi.fn().mockResolvedValue({
                items: testResources,
                totalCount: testResources.length
            });

            const columnHandler = new ColumnListRowHandler({
                columns,
                hideSelectionCheckboxColumn: true
            });

            render(
                <div style={{ width: 800, height: 600 }}>
                    <FilezProvider>
                        <ResourceList<TestResource>
                            resourceType="TestResource"
                            defaultSortBy="name"
                            defaultSortDirection={SortDirection.Ascending}
                            initialRowHandler="ColumnListRowHandler"
                            getResourcesList={mockGetResourcesList}
                            rowHandlers={[columnHandler]}
                        />
                    </FilezProvider>
                </div>
            );

            // Wait for ResourceList to load
            await waitFor(
                () => {
                    expect(mockGetResourcesList).toHaveBeenCalledWith(
                        expect.objectContaining({
                            sortBy: "name",
                            sortDirection: SortDirection.Ascending,
                            fromIndex: 0,
                            limit: expect.any(Number)
                        })
                    );
                },
                { timeout: 3000 }
            );
        });

        test("should handle empty data gracefully", async () => {
            const columns = createTestColumns();

            const mockGetResourcesList = vi.fn().mockResolvedValue({
                items: [],
                totalCount: 0
            });

            const columnHandler = new ColumnListRowHandler({
                columns,
                hideSelectionCheckboxColumn: true
            });

            const { container } = render(
                <div style={{ width: 800, height: 600 }}>
                    <FilezProvider>
                        <ResourceList<TestResource>
                            resourceType="TestResource"
                            defaultSortBy="name"
                            defaultSortDirection={SortDirection.Ascending}
                            initialRowHandler="ColumnListRowHandler"
                            getResourcesList={mockGetResourcesList}
                            rowHandlers={[columnHandler]}
                        />
                    </FilezProvider>
                </div>
            );

            // Wait for the component to load with empty data
            await waitFor(
                () => {
                    expect(mockGetResourcesList).toHaveBeenCalled();
                },
                { timeout: 3000 }
            );

            // Verify component structure is rendered
            expect(container.querySelector(".ResourceList")).toBeInTheDocument();

            // Check headers are present
            expect(screen.getByText("Name")).toBeInTheDocument();
            expect(screen.getByText("Size")).toBeInTheDocument();
            expect(screen.getByText("Type")).toBeInTheDocument();
        });
    });
});

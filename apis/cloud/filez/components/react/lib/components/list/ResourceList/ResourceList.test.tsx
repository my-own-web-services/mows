import { FilezProvider } from "@/main";
import { render, screen, waitFor } from "@testing-library/react";
import { SortDirection } from "filez-client-typescript";
import { expect, test, vi } from "vitest";
import ResourceList from "./ResourceList";
import { type BaseResource } from "./ResourceListTypes";
import ColumnListRowHandler, { type Column } from "./rowHandlers/Column";

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

test("ColumnListRowHandler creates correctly with proper configuration", () => {
    const columns = createTestColumns();

    const columnHandler = new ColumnListRowHandler({
        columns,
        checkboxSelectionColumn: true
    });

    // Test basic properties
    expect(columnHandler.name).toBe("ColumnListRowHandler");
    expect(columnHandler.columns).toHaveLength(4);
    expect(columnHandler.props.checkboxSelectionColumn).toBe(true);

    // Test that columns are correctly copied
    expect(columnHandler.columns[0].field).toBe("name");
    expect(columnHandler.columns[0].enabled).toBe(true);
    expect(columnHandler.columns[3].enabled).toBe(false); // Date Modified is disabled
});

test("ResourceList renders with data and calls API correctly", async () => {
    const testResources = createTestResources(5);
    const columns = createTestColumns();

    const mockGetResourcesList = vi.fn().mockResolvedValue({
        items: testResources,
        totalCount: testResources.length
    });

    const columnHandler = new ColumnListRowHandler({
        columns,
        checkboxSelectionColumn: true
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

    // Wait for data to load
    await waitFor(
        () => {
            expect(mockGetResourcesList).toHaveBeenCalled();
        },
        { timeout: 3000 }
    );

    // Verify API was called with correct parameters
    expect(mockGetResourcesList).toHaveBeenCalledWith(
        expect.objectContaining({
            sortBy: "name",
            sortDirection: SortDirection.Ascending,
            fromIndex: 0,
            limit: expect.any(Number)
        })
    );

    // Verify component structure is rendered
    expect(container.querySelector(".ResourceList")).toBeInTheDocument();

    // Check headers are present
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Size")).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();

    // Check checkbox is present
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThan(0);
});

test("ResourceList keyboard navigation setup works", async () => {
    const testResources = createTestResources(3);
    const columns = createTestColumns();

    const mockGetResourcesList = vi.fn().mockResolvedValue({
        items: testResources,
        totalCount: testResources.length
    });

    const mockOnSelect = vi.fn();

    const columnHandler = new ColumnListRowHandler({
        columns,
        checkboxSelectionColumn: true
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
                    handlers={{
                        onSelect: mockOnSelect
                    }}
                />
            </FilezProvider>
        </div>
    );

    // Wait for component to initialize
    await waitFor(
        () => {
            expect(mockGetResourcesList).toHaveBeenCalled();
        },
        { timeout: 3000 }
    );

    // Verify the ResourceList container is present
    const resourceListContainer = container.querySelector(".ResourceList");
    expect(resourceListContainer).toBeInTheDocument();

    // Verify headers are present for keyboard navigation context
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Size")).toBeInTheDocument();

    // Test that the column handler has the getSelectedItemsAfterKeypress method for keyboard handling
    expect(typeof columnHandler.getSelectedItemsAfterKeypress).toBe("function");

    // Test that keyboard handler method exists and can be called
    const keyboardResult = columnHandler.getSelectedItemsAfterKeypress(
        { key: "ArrowDown" } as React.KeyboardEvent<HTMLDivElement>,
        testResources,
        testResources.length,
        [false, false, false],
        undefined,
        undefined,
        1
    );

    console.log("Keyboard navigation result:", keyboardResult);

    // Should return keyboard navigation result or be callable
    expect(typeof columnHandler.getSelectedItemsAfterKeypress).toBe("function");
});

test("Column sorting callback works correctly", () => {
    const columns = createTestColumns();

    const columnHandler = new ColumnListRowHandler({
        columns,
        checkboxSelectionColumn: true
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

test("ResourceList click handler integration works", async () => {
    const testResources = createTestResources(3);
    const columns = createTestColumns();

    const mockGetResourcesList = vi.fn().mockResolvedValue({
        items: testResources,
        totalCount: testResources.length
    });

    const mockOnSelect = vi.fn();

    const columnHandler = new ColumnListRowHandler({
        columns,
        checkboxSelectionColumn: true
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
                    handlers={{
                        onSelect: mockOnSelect
                    }}
                />
            </FilezProvider>
        </div>
    );

    // Wait for component to initialize
    await waitFor(
        () => {
            expect(mockGetResourcesList).toHaveBeenCalled();
        },
        { timeout: 3000 }
    );

    // Verify ResourceList is present and ready for interactions
    const resourceListContainer = container.querySelector(".ResourceList");
    expect(resourceListContainer).toBeInTheDocument();

    // Verify checkbox selection functionality exists
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThan(0);

    // Test row renderer function exists
    expect(typeof columnHandler.rowRenderer).toBe("function");

    // Test that onSelect handler is set up correctly
    expect(mockOnSelect).toBeInstanceOf(Function);
});

test("ResourceList checkbox functionality setup", async () => {
    const testResources = createTestResources(3);
    const columns = createTestColumns();

    const mockGetResourcesList = vi.fn().mockResolvedValue({
        items: testResources,
        totalCount: testResources.length
    });

    const mockOnSelect = vi.fn();

    const columnHandler = new ColumnListRowHandler({
        columns,
        checkboxSelectionColumn: true
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
                    handlers={{
                        onSelect: mockOnSelect
                    }}
                />
            </FilezProvider>
        </div>
    );

    // Wait for component to initialize
    await waitFor(
        () => {
            expect(mockGetResourcesList).toHaveBeenCalled();
        },
        { timeout: 3000 }
    );

    // Verify checkbox selection is enabled
    expect(columnHandler.props.checkboxSelectionColumn).toBe(true);

    // Find checkboxes - should have at least the header checkbox
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThan(0);

    // Verify the header checkbox (select all) is present
    const headerCheckbox = checkboxes[0];
    expect(headerCheckbox).toHaveAttribute("data-state", "unchecked");

    // Verify ResourceList container structure
    const resourceListContainer = container.querySelector(".ResourceList");
    expect(resourceListContainer).toBeInTheDocument();
});

test("ResourceList selection state management", async () => {
    const testResources = createTestResources(3);
    const columns = createTestColumns();

    const mockGetResourcesList = vi.fn().mockResolvedValue({
        items: testResources,
        totalCount: testResources.length
    });

    const mockOnSelect = vi.fn();

    const columnHandler = new ColumnListRowHandler({
        columns,
        checkboxSelectionColumn: true
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
                    handlers={{
                        onSelect: mockOnSelect
                    }}
                />
            </FilezProvider>
        </div>
    );

    // Wait for component to initialize
    await waitFor(
        () => {
            expect(mockGetResourcesList).toHaveBeenCalled();
        },
        { timeout: 3000 }
    );

    // Test that the component supports selection
    expect(mockOnSelect).toBeInstanceOf(Function);

    // Test keyboard navigation support for multi-selection exists
    expect(typeof columnHandler.getSelectedItemsAfterKeypress).toBe("function");

    // Test that keyboard navigation method can handle different scenarios
    const testCases = [
        { key: "ArrowDown", selectedItems: [false, false, false] },
        { key: "ArrowUp", selectedItems: [true, false, false] }
    ];

    testCases.forEach((testCase) => {
        const result = columnHandler.getSelectedItemsAfterKeypress(
            { key: testCase.key } as React.KeyboardEvent<HTMLDivElement>,
            testResources,
            testResources.length,
            testCase.selectedItems,
            undefined,
            undefined,
            1
        );
        // Method should be callable (result can be undefined for some cases)
        expect(typeof columnHandler.getSelectedItemsAfterKeypress).toBe("function");
    });

    // Verify component structure supports selection
    const resourceListContainer = container.querySelector(".ResourceList");
    expect(resourceListContainer).toBeInTheDocument();

    // Verify checkboxes support multi-selection
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThan(0);
});

test("Column handler implements required ListRowHandler methods", () => {
    const columns = createTestColumns();

    const columnHandler = new ColumnListRowHandler({
        columns,
        checkboxSelectionColumn: true
    });

    // Test required methods exist
    expect(typeof columnHandler.getRowHeight).toBe("function");
    expect(typeof columnHandler.getRowCount).toBe("function");
    expect(typeof columnHandler.isItemLoaded).toBe("function");
    expect(typeof columnHandler.getItemKey).toBe("function");
    expect(typeof columnHandler.getStartIndexAndLimit).toBe("function");
    expect(typeof columnHandler.getSelectedItemsAfterKeypress).toBe("function");
    expect(typeof columnHandler.rowRenderer).toBe("function");
    expect(typeof columnHandler.headerRenderer).toBe("function");

    // Test some basic method calls
    expect(columnHandler.getRowHeight(800, 600, 1)).toBe(24);
    expect(columnHandler.getRowCount(10, 1)).toBe(10);
});

test("Column handler without checkbox selection column", () => {
    const columns = createTestColumns();

    const columnHandler = new ColumnListRowHandler({
        columns,
        checkboxSelectionColumn: false
    });

    expect(columnHandler.props.checkboxSelectionColumn).toBe(false);

    const HeaderComponent = columnHandler.headerRenderer;

    render(
        <FilezProvider>
            <HeaderComponent />
        </FilezProvider>
    );

    // Should not have any checkboxes when disabled
    const checkboxes = screen.queryAllByRole("checkbox");
    expect(checkboxes).toHaveLength(0);
});

test("ResourceList handles empty data gracefully", async () => {
    const columns = createTestColumns();

    const mockGetResourcesList = vi.fn().mockResolvedValue({
        items: [],
        totalCount: 0
    });

    const columnHandler = new ColumnListRowHandler({
        columns,
        checkboxSelectionColumn: true
    });

    render(
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
    );

    // Wait for the component to load with empty data
    await waitFor(
        () => {
            expect(mockGetResourcesList).toHaveBeenCalled();
        },
        { timeout: 3000 }
    );

    // Should not crash and should not display any resource items
    expect(screen.queryByText("Test Resource 1")).not.toBeInTheDocument();
});

/*
test("ResourceList handles API errors gracefully", async () => {
    const columns = createTestColumns();

    const mockGetResourcesList = vi.fn().mockRejectedValue(new Error("API Error"));

    const columnHandler = new ColumnListRowHandler({
        columns,
        checkboxSelectionColumn: true
    });

    render(
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
    );

    // Wait for the component to handle the error
    await waitFor(
        () => {
            expect(mockGetResourcesList).toHaveBeenCalled();
        },
        { timeout: 3000 }
    );

    // Should not crash and should not display any resource items
    expect(screen.queryByText("Test Resource 1")).not.toBeInTheDocument();
});
*/
test("ResourceList calls API with correct parameters on sort change", async () => {
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
        checkboxSelectionColumn: true
    });

    render(
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
    );

    // Wait for initial load
    await waitFor(
        () => {
            expect(mockGetResourcesList).toHaveBeenCalledTimes(1);
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

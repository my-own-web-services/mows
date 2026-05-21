/**
 * Thin wrapper around `@tanstack/react-table` rendered through the shadcn
 * `Table` primitive. Follows the canonical shadcn data-table recipe:
 *   https://ui.shadcn.com/docs/components/data-table
 *
 * The wrapper handles header/body/empty rendering and accepts:
 * - `columns` — TanStack column defs
 * - `data`    — row data
 * - `rowClassName(row)` — optional per-row class for selection/disabled styling
 * - `onRowClick(row)` / `onRowContextMenu(row, ev)` — optional row interactions
 *
 * Sorting, filtering and pagination are off by default — opt in by passing the
 * relevant TanStack options through `tableOptions`.
 */

import {
    type ColumnDef,
    type RowData,
    type TableOptions,
    flexRender,
    getCoreRowModel,
    useReactTable
} from "@tanstack/react-table";
import * as React from "react";

import { cn } from "@/lib/utils";
import {
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "./table";

export interface DataTableProps<T extends RowData> {
    readonly columns: ColumnDef<T, unknown>[];
    readonly data: T[];
    readonly className?: string;
    readonly emptyText?: React.ReactNode;
    readonly rowClassName?: (row: T) => string | undefined;
    readonly onRowClick?: (row: T, event: React.MouseEvent<HTMLTableRowElement>) => void;
    readonly onRowContextMenu?: (
        row: T,
        event: React.MouseEvent<HTMLTableRowElement>
    ) => void;
    /** Suppress the default header row. */
    readonly hideHeader?: boolean;
    /** Pass-through TanStack options (sorting, filtering, pagination, etc.). */
    readonly tableOptions?: Partial<TableOptions<T>>;
}

export function DataTable<T extends RowData>({
    columns,
    data,
    className,
    emptyText = `no rows`,
    rowClassName,
    onRowClick,
    onRowContextMenu,
    hideHeader,
    tableOptions
}: DataTableProps<T>) {
    const table = useReactTable<T>({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        ...tableOptions
    });

    return (
        // Render the table directly (instead of via the shadcn `Table`
        // primitive) so callers can put scroll on this wrapper element and
        // give the table a constrained height. The primitive nests its own
        // `overflow-auto` div which prevents that.
        <div
            className={cn(`relative w-full overflow-auto`, className)}
        >
            <table className={`w-full caption-bottom text-sm`}>
                {!hideHeader && (
                <TableHeader>
                    {table.getHeaderGroups().map((hg) => (
                        <TableRow key={hg.id}>
                            {hg.headers.map((h) => (
                                <TableHead key={h.id} style={{ width: h.getSize() }}>
                                    {h.isPlaceholder
                                        ? null
                                        : flexRender(h.column.columnDef.header, h.getContext())}
                                </TableHead>
                            ))}
                        </TableRow>
                    ))}
                </TableHeader>
            )}
            <TableBody>
                {table.getRowModel().rows.length === 0 ? (
                    <TableRow>
                        <TableCell
                            colSpan={columns.length}
                            className={`text-muted-foreground text-center`}
                        >
                            {emptyText}
                        </TableCell>
                    </TableRow>
                ) : (
                    table.getRowModel().rows.map((row) => (
                        <TableRow
                            key={row.id}
                            data-state={row.getIsSelected() ? `selected` : undefined}
                            className={cn(
                                onRowClick && `cursor-pointer`,
                                rowClassName?.(row.original)
                            )}
                            onClick={onRowClick ? (e) => onRowClick(row.original, e) : undefined}
                            onContextMenu={
                                onRowContextMenu
                                    ? (e) => onRowContextMenu(row.original, e)
                                    : undefined
                            }
                        >
                            {row.getVisibleCells().map((cell) => (
                                <TableCell key={cell.id}>
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))
                )}
            </TableBody>
            </table>
        </div>
    );
}

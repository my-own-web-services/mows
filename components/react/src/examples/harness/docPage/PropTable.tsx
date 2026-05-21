import * as React from "react";
import { cn } from "../../../../lib/lib/utils";

export interface PropRow {
    readonly name: string;
    readonly type: string;
    readonly default: string;
    readonly description: React.ReactNode;
}

interface PropTableProps {
    /** Optional sub-heading shown above the table (e.g. `<Steps>`). */
    readonly heading?: React.ReactNode;
    readonly rows: ReadonlyArray<PropRow>;
    readonly className?: string;
}

/**
 * Prop reference table for the API Reference section. Use one
 * `<PropTable>` per component (e.g. one for `<Steps>`, one for
 * `<Step>`) so each table is small and easy to scan.
 *
 * Column labels are intentionally not translated — these are JS-API
 * concepts (prop, type, default) familiar to every TS reader.
 */
export const PropTable = ({ heading, rows, className }: PropTableProps) => (
    <div className={cn(`flex flex-col gap-2`, className)}>
        {heading && <p className={`text-sm font-medium`}>{heading}</p>}
        <div className={`overflow-x-auto rounded-md border`}>
            <table className={`w-full text-sm`}>
                <thead
                    className={`bg-muted/40 text-left text-xs uppercase text-muted-foreground`}
                >
                    <tr>
                        <th className={`px-3 py-2 font-medium`}>Prop</th>
                        <th className={`px-3 py-2 font-medium`}>Type</th>
                        <th className={`px-3 py-2 font-medium`}>Default</th>
                        <th className={`px-3 py-2 font-medium`}>Description</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.name} className={`border-t`}>
                            <td className={`px-3 py-2 font-mono text-xs`}>{row.name}</td>
                            <td
                                className={`px-3 py-2 font-mono text-xs text-muted-foreground`}
                            >
                                {row.type}
                            </td>
                            <td
                                className={`px-3 py-2 font-mono text-xs text-muted-foreground`}
                            >
                                {row.default}
                            </td>
                            <td className={`px-3 py-2`}>{row.description}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

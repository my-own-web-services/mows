import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import StaggeredCheckboxes, {
    collectLeafIds,
    getNodeState,
    type StaggeredCheckboxNode
} from "./StaggeredCheckboxes";

const TREE: StaggeredCheckboxNode[] = [
    {
        id: `fruits`,
        label: `Fruits`,
        children: [
            { id: `apple`, label: `Apple` },
            { id: `banana`, label: `Banana` },
            {
                id: `citrus`,
                label: `Citrus`,
                children: [
                    { id: `lemon`, label: `Lemon` },
                    { id: `orange`, label: `Orange` }
                ]
            }
        ]
    },
    {
        id: `vegetables`,
        label: `Vegetables`,
        children: [
            { id: `carrot`, label: `Carrot` },
            { id: `potato`, label: `Potato` }
        ]
    }
];

const Harness = ({
    initial = new Set<string>(),
    ...props
}: Partial<React.ComponentProps<typeof StaggeredCheckboxes>> & {
    initial?: ReadonlySet<string>;
}) => {
    const [value, setValue] = useState<ReadonlySet<string>>(initial);
    return (
        <StaggeredCheckboxes
            nodes={TREE}
            value={value}
            onValueChange={setValue}
            defaultExpanded
            {...props}
        />
    );
};

describe(`StaggeredCheckboxes`, () => {
    it(`renders one checkbox per node`, () => {
        render(<Harness />);
        // 2 roots + 2 children of fruits (apple, banana) + citrus + 2 grandchildren + 2 children of vegetables = 9
        const checkboxes = screen.getAllByRole(`checkbox`);
        expect(checkboxes.length).toBe(9);
    });

    it(`toggling a leaf updates only that id`, async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(
            <StaggeredCheckboxes
                nodes={TREE}
                value={new Set()}
                onValueChange={onChange}
                defaultExpanded
            />
        );
        await user.click(screen.getByRole(`checkbox`, { name: `Apple` }));
        expect(onChange).toHaveBeenCalledTimes(1);
        const next = onChange.mock.calls[0][0] as Set<string>;
        expect(Array.from(next)).toEqual([`apple`]);
    });

    it(`checking a parent propagates to every leaf descendant`, async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(
            <StaggeredCheckboxes
                nodes={TREE}
                value={new Set()}
                onValueChange={onChange}
                defaultExpanded
            />
        );
        await user.click(screen.getByRole(`checkbox`, { name: `Fruits` }));
        const next = onChange.mock.calls[0][0] as Set<string>;
        expect(Array.from(next).sort()).toEqual(
            [`apple`, `banana`, `lemon`, `orange`].sort()
        );
    });

    it(`unchecking a fully-checked parent removes every leaf descendant`, async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(
            <StaggeredCheckboxes
                nodes={TREE}
                value={new Set([`apple`, `banana`, `lemon`, `orange`])}
                onValueChange={onChange}
                defaultExpanded
            />
        );
        await user.click(screen.getByRole(`checkbox`, { name: `Fruits` }));
        const next = onChange.mock.calls[0][0] as Set<string>;
        expect(next.size).toBe(0);
    });

    it(`renders a parent in the indeterminate state when only some descendants are checked`, () => {
        render(<Harness initial={new Set([`apple`])} />);
        const fruits = screen.getByRole(`checkbox`, { name: `Fruits` });
        expect(fruits).toHaveAttribute(`data-state`, `indeterminate`);
        expect(fruits).toHaveAttribute(`aria-checked`, `mixed`);
    });

    it(`renders a parent as checked when every leaf descendant is checked`, () => {
        render(
            <Harness initial={new Set([`apple`, `banana`, `lemon`, `orange`])} />
        );
        const fruits = screen.getByRole(`checkbox`, { name: `Fruits` });
        expect(fruits).toHaveAttribute(`data-state`, `checked`);
    });

    it(`clicking an indeterminate parent escalates to fully checked`, async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(
            <StaggeredCheckboxes
                nodes={TREE}
                value={new Set([`apple`])}
                onValueChange={onChange}
                defaultExpanded
            />
        );
        await user.click(screen.getByRole(`checkbox`, { name: `Fruits` }));
        const next = onChange.mock.calls[0][0] as Set<string>;
        expect(Array.from(next).sort()).toEqual(
            [`apple`, `banana`, `lemon`, `orange`].sort()
        );
    });

    it(`search filters the tree to matching nodes (case-insensitive)`, async () => {
        const user = userEvent.setup();
        render(<Harness searchable />);
        const search = screen.getByRole(`searchbox`);
        await user.type(search, `lem`);
        expect(screen.queryByRole(`checkbox`, { name: `Apple` })).toBeNull();
        expect(screen.queryByRole(`checkbox`, { name: `Banana` })).toBeNull();
        expect(screen.queryByRole(`checkbox`, { name: `Vegetables` })).toBeNull();
        // The matched leaf and its ancestor chain stay visible.
        expect(screen.getByRole(`checkbox`, { name: `Lemon` })).toBeInTheDocument();
        expect(screen.getByRole(`checkbox`, { name: `Citrus` })).toBeInTheDocument();
        expect(screen.getByRole(`checkbox`, { name: `Fruits` })).toBeInTheDocument();
    });

    it(`renders the empty label when search has no matches`, async () => {
        const user = userEvent.setup();
        render(<Harness searchable emptyLabel={`Nothing here`} />);
        await user.type(screen.getByRole(`searchbox`), `xxx`);
        expect(screen.getByText(`Nothing here`)).toBeInTheDocument();
    });

    it(`branches collapse and expand via the disclosure button`, async () => {
        const user = userEvent.setup();
        render(
            <StaggeredCheckboxes
                nodes={TREE}
                value={new Set()}
                onValueChange={() => undefined}
            />
        );
        // Collapsed by default — leaves of Fruits are not in the document.
        expect(screen.queryByRole(`checkbox`, { name: `Apple` })).toBeNull();
        const fruitsItem = screen
            .getByRole(`checkbox`, { name: `Fruits` })
            .closest(`[role="treeitem"]`)!;
        const expand = within(fruitsItem as HTMLElement).getByRole(`button`, {
            name: `Expand`
        });
        await user.click(expand);
        expect(screen.getByRole(`checkbox`, { name: `Apple` })).toBeInTheDocument();
    });

    it(`disabled nodes are not togglable and are excluded from cascading writes`, async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const disabledTree: StaggeredCheckboxNode[] = [
            {
                id: `parent`,
                label: `Parent`,
                children: [
                    { id: `child-a`, label: `Child A` },
                    { id: `child-b`, label: `Child B`, disabled: true }
                ]
            }
        ];
        render(
            <StaggeredCheckboxes
                nodes={disabledTree}
                value={new Set()}
                onValueChange={onChange}
                defaultExpanded
            />
        );
        await user.click(screen.getByRole(`checkbox`, { name: `Parent` }));
        const next = onChange.mock.calls[0][0] as Set<string>;
        // Only the enabled leaf gets selected.
        expect(Array.from(next)).toEqual([`child-a`]);
    });

    it(`cascade="selfOnly" toggles just the clicked node`, async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(
            <StaggeredCheckboxes
                nodes={TREE}
                value={new Set()}
                onValueChange={onChange}
                defaultExpanded
                cascade={`selfOnly`}
            />
        );
        await user.click(screen.getByRole(`checkbox`, { name: `Fruits` }));
        const next = onChange.mock.calls[0][0] as Set<string>;
        expect(Array.from(next)).toEqual([`fruits`]);
    });

    it(`getNodeState helper returns indeterminate when descendants disagree`, () => {
        const value = new Set([`apple`]);
        expect(getNodeState(TREE[0], value)).toBe(`indeterminate`);
        const all = new Set([`apple`, `banana`, `lemon`, `orange`]);
        expect(getNodeState(TREE[0], all)).toBe(`checked`);
        const none = new Set<string>();
        expect(getNodeState(TREE[0], none)).toBe(`unchecked`);
    });

    it(`collectLeafIds returns every leaf descendant id`, () => {
        expect(collectLeafIds(TREE[0]).sort()).toEqual(
            [`apple`, `banana`, `lemon`, `orange`].sort()
        );
    });
});

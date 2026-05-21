import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import SearchSelectPicker from "./SearchSelectPicker";

interface Fruit {
    readonly id: string;
    readonly name: string;
}

const FRUITS: Fruit[] = [
    { id: `apple`, name: `Apple` },
    { id: `banana`, name: `Banana` },
    { id: `cherry`, name: `Cherry` }
];

const renderPicker = (
    opts: {
        standalone?: boolean;
        selected?: Fruit;
        onSelect?: (f: Fruit) => void;
        defaultOpen?: boolean;
    } = {}
) =>
    render(
        <SearchSelectPicker<Fruit>
            items={FRUITS}
            selected={opts.selected}
            onSelect={opts.onSelect ?? (() => undefined)}
            getId={(f) => f.id}
            matchesSearch={(f, q) => f.name.toLowerCase().includes(q.toLowerCase())}
            renderItemContent={(f) => <span>{f.name}</span>}
            placeholder={`Search fruit…`}
            emptyText={`No matches`}
            triggerTitle={`Pick fruit`}
            standalone={opts.standalone}
            defaultOpen={opts.defaultOpen}
        />
    );

describe(`SearchSelectPicker`, () => {
    it(`renders every item inline in standalone mode`, () => {
        renderPicker({ standalone: true });
        expect(screen.getByText(`Apple`)).toBeInTheDocument();
        expect(screen.getByText(`Banana`)).toBeInTheDocument();
        expect(screen.getByText(`Cherry`)).toBeInTheDocument();
    });

    it(`filters items by search in standalone mode`, async () => {
        const user = userEvent.setup();
        renderPicker({ standalone: true });
        const search = screen.getByPlaceholderText(`Search fruit…`);
        await user.type(search, `Ban`);
        expect(screen.getByText(`Banana`)).toBeInTheDocument();
        expect(screen.queryByText(`Apple`)).toBeNull();
        expect(screen.queryByText(`Cherry`)).toBeNull();
    });

    it(`shows the empty-text fallback when search matches nothing`, async () => {
        const user = userEvent.setup();
        renderPicker({ standalone: true });
        await user.type(screen.getByPlaceholderText(`Search fruit…`), `xxxxx`);
        expect(screen.getByText(`No matches`)).toBeInTheDocument();
    });

    it(`fires onSelect with the chosen item in standalone mode`, async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();
        renderPicker({ standalone: true, onSelect });
        await user.click(screen.getByText(`Banana`));
        expect(onSelect).toHaveBeenCalledWith(FRUITS[1]);
    });

    it(`is fully controllable via selected + onSelect`, async () => {
        const user = userEvent.setup();
        const Controlled = () => {
            const [v, setV] = useState<Fruit>(FRUITS[0]!);
            return (
                <>
                    <SearchSelectPicker<Fruit>
                        items={FRUITS}
                        selected={v}
                        onSelect={setV}
                        getId={(f) => f.id}
                        matchesSearch={(f, q) =>
                            f.name.toLowerCase().includes(q.toLowerCase())
                        }
                        renderItemContent={(f) => <span>{f.name}</span>}
                        placeholder={`Search…`}
                        emptyText={`empty`}
                        triggerTitle={`pick`}
                        standalone
                    />
                    <span data-testid={`v`}>{v.id}</span>
                </>
            );
        };
        render(<Controlled />);
        expect(screen.getByTestId(`v`)).toHaveTextContent(`apple`);
        await user.click(screen.getByText(`Cherry`));
        expect(screen.getByTestId(`v`)).toHaveTextContent(`cherry`);
    });

    it(`popover mode renders a trigger that opens the search list`, async () => {
        const user = userEvent.setup();
        renderPicker({ selected: FRUITS[0] });
        // The trigger renders the currently-selected item content. Its
        // accessible name comes from triggerTitle via the title attribute,
        // and the role depends on the implementation — use the title to
        // locate it.
        const trigger = screen.getByTitle(`Pick fruit`);
        expect(trigger).toBeInTheDocument();
        await user.click(trigger);
        expect(screen.getByPlaceholderText(`Search fruit…`)).toBeInTheDocument();
    });
});

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import OptionPicker, { type OptionItem } from "./OptionPicker";

const baseOptions: OptionItem[] = [
    { id: `a`, label: `Alpha`, enabled: true },
    { id: `b`, label: `Beta`, enabled: false },
    { id: `c`, label: `Gamma`, enabled: true }
];

describe(`OptionPicker`, () => {
    it(`renders the trigger label`, () => {
        render(<OptionPicker options={baseOptions} onOptionChange={() => undefined} triggerComponent={`Filter`} />);
        expect(screen.getByText(`Filter`)).toBeInTheDocument();
    });

    it(`renders the enabled/total count on the trigger by default`, () => {
        render(<OptionPicker options={baseOptions} onOptionChange={() => undefined} />);
        expect(screen.getByText(/\(2\/3\)/)).toBeInTheDocument();
    });

    it(`omits the count when showCount={false}`, () => {
        render(<OptionPicker options={baseOptions} onOptionChange={() => undefined} showCount={false} />);
        expect(screen.queryByText(/\(2\/3\)/)).toBeNull();
    });

    it(`renders one menuitemcheckbox per option after opening`, async () => {
        const user = userEvent.setup();
        render(<OptionPicker options={baseOptions} onOptionChange={() => undefined} />);
        await user.click(screen.getByRole(`button`));
        const items = screen.getAllByRole(`menuitemcheckbox`);
        expect(items.length).toBe(3);
    });

    it(`fires onOptionChange when a menu item is toggled`, async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<OptionPicker options={baseOptions} onOptionChange={onChange} />);
        await user.click(screen.getByRole(`button`));
        await user.click(screen.getByRole(`menuitemcheckbox`, { name: `Beta` }));
        expect(onChange).toHaveBeenCalledWith(`b`, true);
    });

    it(`stays open after toggling an option (preventDefault on select)`, async () => {
        const user = userEvent.setup();
        const Controlled = () => {
            const [opts, setOpts] = useState(baseOptions);
            return (
                <OptionPicker
                    options={opts}
                    onOptionChange={(id, enabled) =>
                        setOpts((prev) => prev.map((o) => (o.id === id ? { ...o, enabled } : o)))
                    }
                />
            );
        };
        render(<Controlled />);
        await user.click(screen.getByRole(`button`));
        await user.click(screen.getByRole(`menuitemcheckbox`, { name: `Beta` }));
        // Menu items should still be reachable — the menu didn't auto-close.
        expect(screen.getByRole(`menuitemcheckbox`, { name: `Alpha` })).toBeInTheDocument();
    });

    it(`renders the optional header label`, async () => {
        const user = userEvent.setup();
        render(
            <OptionPicker
                options={baseOptions}
                onOptionChange={() => undefined}
                header={`Columns`}
            />
        );
        await user.click(screen.getByRole(`button`));
        expect(screen.getByText(`Columns`)).toBeInTheDocument();
    });

    it(`disabled trigger forwards the disabled attribute and ignores clicks`, async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<OptionPicker options={baseOptions} onOptionChange={onChange} disabled />);
        const trigger = screen.getByRole(`button`);
        expect(trigger).toBeDisabled();
        await user.click(trigger);
        // userEvent does not propagate clicks to disabled buttons — onChange
        // never fires, regardless of any leaked portal nodes from earlier
        // tests in the suite.
        expect(onChange).not.toHaveBeenCalled();
    });
});

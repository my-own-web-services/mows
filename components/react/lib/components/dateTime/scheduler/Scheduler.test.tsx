import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import Scheduler from "./Scheduler";
import type { ScheduleItem } from "./types";

afterEach(cleanup);

const at = (h: number, mi = 0) => new Date(2026, 5, 16, h, mi); // 16 Jun 2026
const FOCUS = new Date(2026, 5, 16);

const EVENTS: ScheduleItem[] = [
    { id: `a`, title: `Standup`, start: at(9), end: at(9, 30) },
    { id: `b`, title: `Lunch`, start: at(12), end: at(13), color: `#e11d48` },
    {
        id: `c`,
        title: `All-hands`,
        start: new Date(2026, 5, 18),
        end: new Date(2026, 5, 19),
        allDay: true
    }
];

describe(`Scheduler`, () => {
    it(`renders the month view: toolbar, group label, and an event chip`, () => {
        render(<Scheduler events={EVENTS} defaultDate={FOCUS} defaultView={`month`} />);
        expect(screen.getByRole(`group`, { name: /event calendar/i })).toBeInTheDocument();
        expect(screen.getByRole(`button`, { name: `Today` })).toBeInTheDocument();
        expect(screen.getAllByText(`Standup`).length).toBeGreaterThan(0);
    });

    it(`lists events grouped by day in agenda view`, () => {
        render(<Scheduler events={EVENTS} defaultDate={FOCUS} defaultView={`agenda`} />);
        expect(screen.getByText(`Standup`)).toBeInTheDocument();
        expect(screen.getByText(`Lunch`)).toBeInTheDocument();
        expect(screen.getByText(`All-hands`)).toBeInTheDocument();
    });

    it(`shows the agenda empty state when there are no events`, () => {
        render(<Scheduler events={[]} defaultDate={FOCUS} defaultView={`agenda`} />);
        expect(screen.getByText(`No events`)).toBeInTheDocument();
    });

    it(`renders the time grid (week) with the all-day band`, () => {
        render(<Scheduler events={EVENTS} defaultDate={FOCUS} defaultView={`week`} />);
        expect(screen.getByText(`All day`)).toBeInTheDocument();
    });

    it(`renders a single day column in day view`, () => {
        render(<Scheduler events={EVENTS} defaultDate={FOCUS} defaultView={`day`} />);
        // The clicked event is reachable as a button labelled by its title.
        expect(screen.getByRole(`button`, { name: /Standup/ })).toBeInTheDocument();
    });

    it(`fires onSelectItem when an event is clicked`, async () => {
        const onSelectItem = vi.fn();
        render(
            <Scheduler
                events={EVENTS}
                defaultDate={FOCUS}
                defaultView={`agenda`}
                onSelectItem={onSelectItem}
            />
        );
        await userEvent.click(screen.getByText(`Standup`));
        expect(onSelectItem).toHaveBeenCalledWith(expect.objectContaining({ id: `a` }));
    });

    it(`fires onSelectSlot with an all-day slot when an empty month cell is clicked`, async () => {
        const onSelectSlot = vi.fn();
        render(
            <Scheduler
                events={[]}
                defaultDate={FOCUS}
                defaultView={`month`}
                onSelectSlot={onSelectSlot}
            />
        );
        const cells = screen.getAllByRole(`button`, { name: /Add event/i });
        await userEvent.click(cells[8]);
        expect(onSelectSlot).toHaveBeenCalledWith(
            expect.objectContaining({ allDay: true, view: `month` })
        );
    });

    it(`switches the view via the toolbar and reports it (uncontrolled)`, async () => {
        const onViewChange = vi.fn();
        render(
            <Scheduler
                events={EVENTS}
                defaultDate={FOCUS}
                defaultView={`month`}
                onViewChange={onViewChange}
            />
        );
        await userEvent.click(screen.getByRole(`tab`, { name: `Agenda` }));
        expect(onViewChange).toHaveBeenCalledWith(`agenda`);
        // And the agenda content actually rendered.
        expect(screen.getByText(`Lunch`)).toBeInTheDocument();
    });

    it(`navigates to the next month when the next button is pressed`, async () => {
        const onNavigate = vi.fn();
        render(
            <Scheduler
                events={EVENTS}
                defaultDate={FOCUS}
                defaultView={`month`}
                onNavigate={onNavigate}
            />
        );
        await userEvent.click(screen.getByRole(`button`, { name: `Next` }));
        expect(onNavigate).toHaveBeenCalledTimes(1);
        const [nextDate] = onNavigate.mock.calls[0];
        expect((nextDate as Date).getMonth()).toBe(6); // July
    });

    it(`makes only editable items draggable when onItemMove is set`, () => {
        const items: ScheduleItem[] = [
            { id: `m`, title: `Movable`, start: at(9), end: at(10), editable: true },
            { id: `f`, title: `Fixed`, start: at(11), end: at(12) }
        ];
        render(
            <Scheduler
                events={items}
                defaultDate={FOCUS}
                defaultView={`week`}
                onItemMove={vi.fn()}
            />
        );
        expect(screen.getByRole(`button`, { name: /Movable/ }).className).toMatch(/cursor-grab/);
        expect(screen.getByRole(`button`, { name: /Fixed/ }).className).not.toMatch(/cursor-grab/);
    });

    it(`leaves editable items non-draggable without an onItemMove handler`, () => {
        const items: ScheduleItem[] = [
            { id: `m`, title: `Movable`, start: at(9), end: at(10), editable: true }
        ];
        render(<Scheduler events={items} defaultDate={FOCUS} defaultView={`week`} />);
        expect(screen.getByRole(`button`, { name: /Movable/ }).className).not.toMatch(/cursor-grab/);
    });
});

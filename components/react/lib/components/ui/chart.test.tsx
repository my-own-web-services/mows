import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

// Recharts' ResponsiveContainer hides its children until ResizeObserver
// reports a non-zero size. jsdom never fires layout events, so the chart
// subtree (and any siblings inside the container) stays invisible. We
// swap it for a plain pass-through so the test environment can assert on
// the rendered tooltip / legend rows.
vi.mock(import(`recharts`), async (importOriginal) => {
    const actual = await importOriginal();
    const ReactImpl = await import(`react`);
    return {
        ...actual,
        ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
            ReactImpl.createElement(`div`, { 'data-mock-responsive-container': true }, children)
    };
});

import {
    Bar,
    BarChart,
    Tooltip as RechartsTooltip
} from "recharts";
import {
    ChartContainer,
    ChartLegendContent,
    ChartStyle,
    ChartTooltipContent,
    type ChartConfig
} from "./chart";

const baseConfig: ChartConfig = {
    desktop: { label: `Desktop`, color: `#4f46e5` },
    mobile: { label: `Mobile`, color: `#22d3ee` }
};

describe(`ChartContainer`, () => {
    it(`renders a data-slot="chart" wrapper`, () => {
        const { container } = render(
            <ChartContainer config={baseConfig}>
                <BarChart data={[{ month: `Jan`, desktop: 10 }]}>
                    <Bar dataKey={`desktop`} />
                </BarChart>
            </ChartContainer>
        );
        const root = container.querySelector(`[data-slot="chart"]`);
        expect(root).toBeInTheDocument();
    });

    it(`tags the wrapper with a stable data-chart id`, () => {
        const { container } = render(
            <ChartContainer id={`pinned`} config={baseConfig}>
                <BarChart data={[]}>
                    <Bar dataKey={`desktop`} />
                </BarChart>
            </ChartContainer>
        );
        const root = container.querySelector(`[data-slot="chart"]`);
        expect(root?.getAttribute(`data-chart`)).toBe(`chart-pinned`);
    });

    it(`forwards an extra className`, () => {
        const { container } = render(
            <ChartContainer className={`custom-cls`} config={baseConfig}>
                <BarChart data={[]}>
                    <Bar dataKey={`desktop`} />
                </BarChart>
            </ChartContainer>
        );
        const root = container.querySelector(`[data-slot="chart"]`);
        expect(root?.className).toMatch(/custom-cls/);
    });

    it(`emits a <ChartStyle> block with CSS vars from the config`, () => {
        const { container } = render(
            <ChartContainer id={`vars`} config={baseConfig}>
                <BarChart data={[]}>
                    <Bar dataKey={`desktop`} />
                </BarChart>
            </ChartContainer>
        );
        const style = container.querySelector(`style`);
        expect(style).toBeInTheDocument();
        expect(style?.innerHTML).toContain(`[data-chart=chart-vars]`);
        expect(style?.innerHTML).toContain(`--color-desktop: #4f46e5`);
        expect(style?.innerHTML).toContain(`--color-mobile: #22d3ee`);
    });

    it(`mounts a recharts Tooltip child when one is configured`, () => {
        // Sanity-check that a recharts subtree mounts inside the container
        // without throwing — full recharts rendering relies on element
        // measurement which is mocked in this test environment.
        render(
            <ChartContainer config={baseConfig}>
                <BarChart data={[{ month: `Jan`, desktop: 10 }]}>
                    <RechartsTooltip />
                    <Bar dataKey={`desktop`} />
                </BarChart>
            </ChartContainer>
        );
    });
});

describe(`ChartStyle`, () => {
    it(`renders nothing when no config entry has a color or theme`, () => {
        const { container } = render(
            <ChartStyle id={`empty`} config={{ desktop: { label: `Desktop` } }} />
        );
        expect(container.querySelector(`style`)).toBeNull();
    });

    it(`renders a style block with both light and dark theme selectors`, () => {
        const { container } = render(
            <ChartStyle
                id={`themed`}
                config={{
                    desktop: {
                        label: `Desktop`,
                        theme: { light: `#000`, dark: `#fff` }
                    }
                }}
            />
        );
        const style = container.querySelector(`style`);
        expect(style?.innerHTML).toContain(`[data-chart=themed] {`);
        expect(style?.innerHTML).toContain(`.dark [data-chart=themed] {`);
        expect(style?.innerHTML).toContain(`--color-desktop: #000`);
        expect(style?.innerHTML).toContain(`--color-desktop: #fff`);
    });
});

describe(`ChartTooltipContent`, () => {
    it(`renders nothing when not active`, () => {
        const { container } = render(
            <ChartContainer config={baseConfig}>
                <BarChart data={[]}>
                    <Bar dataKey={`desktop`} />
                </BarChart>
                <ChartTooltipContent active={false} payload={[]} />
            </ChartContainer>
        );
        expect(container.textContent).not.toContain(`Desktop`);
    });

    it(`renders the configured label and formatted value for a payload entry`, () => {
        render(
            <ChartContainer config={baseConfig}>
                <BarChart data={[]}>
                    <Bar dataKey={`desktop`} />
                </BarChart>
                <ChartTooltipContent
                    active
                    label={`Jan`}
                    payload={[
                        {
                            dataKey: `desktop`,
                            name: `desktop`,
                            value: 1234,
                            color: `#4f46e5`,
                            payload: { month: `Jan`, desktop: 1234 }
                        }
                    ]}
                />
            </ChartContainer>
        );
        expect(screen.getByText(`Desktop`)).toBeInTheDocument();
        // Value gets `.toLocaleString()` — accept both `1,234` and `1234`
        // depending on jsdom's locale.
        expect(screen.getByText(/1[,.]?234/)).toBeInTheDocument();
    });
});

describe(`ChartLegendContent`, () => {
    it(`renders nothing when payload is empty`, () => {
        const { container } = render(
            <ChartContainer config={baseConfig}>
                <BarChart data={[]}>
                    <Bar dataKey={`desktop`} />
                </BarChart>
                <ChartLegendContent payload={[]} />
            </ChartContainer>
        );
        expect(container.textContent).not.toContain(`Desktop`);
    });

    it(`renders one row per payload entry with the configured label`, () => {
        render(
            <ChartContainer config={baseConfig}>
                <BarChart data={[]}>
                    <Bar dataKey={`desktop`} />
                </BarChart>
                <ChartLegendContent
                    payload={[
                        {
                            value: `desktop`,
                            dataKey: `desktop`,
                            color: `#4f46e5`
                        },
                        {
                            value: `mobile`,
                            dataKey: `mobile`,
                            color: `#22d3ee`
                        }
                    ]}
                />
            </ChartContainer>
        );
        expect(screen.getByText(`Desktop`)).toBeInTheDocument();
        expect(screen.getByText(`Mobile`)).toBeInTheDocument();
    });
});

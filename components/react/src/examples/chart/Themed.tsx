import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig
} from "../../../lib/components/ui/chart";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const data = [
    { quarter: `Q1`, revenue: 12_500 },
    { quarter: `Q2`, revenue: 18_300 },
    { quarter: `Q3`, revenue: 22_100 },
    { quarter: `Q4`, revenue: 27_600 }
];

// `theme` replaces the single `color` field — the chart container
// emits two CSS scopes (`[data-chart=…]` and `.dark [data-chart=…]`)
// so the same series flips when the user toggles between themes.
const config = {
    revenue: {
        label: `Revenue`,
        theme: { light: `#0f172a`, dark: `#f8fafc` }
    }
} satisfies ChartConfig;

const Example = () => {
    useExampleState({ variant: `themed`, modes: [`light`, `dark`] });

    return (
        <ChartContainer config={config} className={`min-h-[260px] w-full`}>
            <BarChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                    dataKey={`quarter`}
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent indicator={`line`} />} />
                <Bar dataKey={`revenue`} fill={`var(--color-revenue)`} radius={4} />
            </BarChart>
        </ChartContainer>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.chart.themed,
    Example
};

export default module;

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig
} from "../../../lib/components/ui/chart";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const data = [
    { month: `Jan`, desktop: 186, mobile: 80 },
    { month: `Feb`, desktop: 305, mobile: 200 },
    { month: `Mar`, desktop: 237, mobile: 120 },
    { month: `Apr`, desktop: 173, mobile: 190 },
    { month: `May`, desktop: 209, mobile: 130 },
    { month: `Jun`, desktop: 264, mobile: 210 }
];

const config = {
    desktop: { label: `Desktop`, color: `var(--chart-1)` },
    mobile: { label: `Mobile`, color: `var(--chart-2)` }
} satisfies ChartConfig;

const Example = () => {
    useExampleState({ variant: `bar`, rows: data.length });

    return (
        <ChartContainer config={config} className={`min-h-[260px] w-full`}>
            <BarChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                    dataKey={`month`}
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey={`desktop`} fill={`var(--color-desktop)`} radius={4} />
                <Bar dataKey={`mobile`} fill={`var(--color-mobile)`} radius={4} />
            </BarChart>
        </ChartContainer>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.chart.bar,
    Example
};

export default module;

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import {
    ChartContainer,
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
    useExampleState({ variant: `area-stacked`, series: Object.keys(config) });

    return (
        <ChartContainer config={config} className={`min-h-[260px] w-full`}>
            <AreaChart data={data} margin={{ top: 12, right: 12, left: 12, bottom: 0 }}>
                <defs>
                    <linearGradient id={`fill-desktop`} x1={`0`} y1={`0`} x2={`0`} y2={`1`}>
                        <stop offset={`5%`} stopColor={`var(--color-desktop)`} stopOpacity={0.8} />
                        <stop offset={`95%`} stopColor={`var(--color-desktop)`} stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id={`fill-mobile`} x1={`0`} y1={`0`} x2={`0`} y2={`1`}>
                        <stop offset={`5%`} stopColor={`var(--color-mobile)`} stopOpacity={0.8} />
                        <stop offset={`95%`} stopColor={`var(--color-mobile)`} stopOpacity={0.1} />
                    </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                    dataKey={`month`}
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator={`dot`} />} />
                <Area
                    dataKey={`mobile`}
                    type={`natural`}
                    fill={`url(#fill-mobile)`}
                    stroke={`var(--color-mobile)`}
                    stackId={`a`}
                />
                <Area
                    dataKey={`desktop`}
                    type={`natural`}
                    fill={`url(#fill-desktop)`}
                    stroke={`var(--color-desktop)`}
                    stackId={`a`}
                />
            </AreaChart>
        </ChartContainer>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.chart.area,
    Example
};

export default module;

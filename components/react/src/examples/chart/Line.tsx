import { CartesianGrid, Line, LineChart, XAxis } from "recharts";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig
} from "../../../lib/components/ui/chart";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const data = [
    { month: `Jan`, requests: 186 },
    { month: `Feb`, requests: 305 },
    { month: `Mar`, requests: 237 },
    { month: `Apr`, requests: 273 },
    { month: `May`, requests: 209 },
    { month: `Jun`, requests: 414 }
];

const config = {
    requests: { label: `Requests`, color: `var(--chart-1)` }
} satisfies ChartConfig;

const Example = () => {
    useExampleState({ variant: `line`, points: data.length });

    return (
        <ChartContainer config={config} className={`min-h-[260px] w-full`}>
            <LineChart data={data} margin={{ top: 12, right: 12, left: 12, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                    dataKey={`month`}
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator={`line`} />} />
                <Line
                    dataKey={`requests`}
                    type={`monotone`}
                    stroke={`var(--color-requests)`}
                    strokeWidth={2}
                    dot={false}
                />
            </LineChart>
        </ChartContainer>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.chart.line,
    Example
};

export default module;

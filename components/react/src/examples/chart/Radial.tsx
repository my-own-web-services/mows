import { RadialBar, RadialBarChart } from "recharts";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig
} from "../../../lib/components/ui/chart";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const data = [
    { browser: `chrome`, visitors: 275, fill: `var(--color-chrome)` },
    { browser: `safari`, visitors: 200, fill: `var(--color-safari)` },
    { browser: `firefox`, visitors: 187, fill: `var(--color-firefox)` },
    { browser: `edge`, visitors: 173, fill: `var(--color-edge)` },
    { browser: `other`, visitors: 90, fill: `var(--color-other)` }
];

const config = {
    visitors: { label: `Visitors` },
    chrome: { label: `Chrome`, color: `var(--chart-1)` },
    safari: { label: `Safari`, color: `var(--chart-2)` },
    firefox: { label: `Firefox`, color: `var(--chart-3)` },
    edge: { label: `Edge`, color: `var(--chart-4)` },
    other: { label: `Other`, color: `var(--chart-5)` }
} satisfies ChartConfig;

const Example = () => {
    useExampleState({ variant: `radial`, rings: data.length });

    return (
        <ChartContainer config={config} className={`mx-auto aspect-square min-h-[280px] max-w-[400px]`}>
            <RadialBarChart data={data} innerRadius={30} outerRadius={120}>
                <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel nameKey={`browser`} />}
                />
                <RadialBar dataKey={`visitors`} background />
            </RadialBarChart>
        </ChartContainer>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.chart.radial,
    Example
};

export default module;

import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig
} from "../../../lib/components/ui/chart";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const data = [
    { skill: `Speed`, current: 80, target: 100 },
    { skill: `Reliability`, current: 92, target: 100 },
    { skill: `Cost`, current: 65, target: 100 },
    { skill: `Security`, current: 78, target: 100 },
    { skill: `DX`, current: 86, target: 100 },
    { skill: `Coverage`, current: 70, target: 100 }
];

const config = {
    current: { label: `Current`, color: `var(--chart-1)` },
    target: { label: `Target`, color: `var(--chart-3)` }
} satisfies ChartConfig;

const Example = () => {
    useExampleState({ variant: `radar`, axes: data.length });

    return (
        <ChartContainer config={config} className={`mx-auto aspect-square min-h-[280px] max-w-[420px]`}>
            <RadarChart data={data}>
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator={`line`} />} />
                <PolarAngleAxis dataKey={`skill`} />
                <PolarGrid />
                <Radar
                    dataKey={`current`}
                    fill={`var(--color-current)`}
                    fillOpacity={0.6}
                    stroke={`var(--color-current)`}
                />
                <Radar
                    dataKey={`target`}
                    fill={`var(--color-target)`}
                    fillOpacity={0}
                    stroke={`var(--color-target)`}
                    strokeDasharray={`4 4`}
                />
            </RadarChart>
        </ChartContainer>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.chart.radar,
    Example
};

export default module;

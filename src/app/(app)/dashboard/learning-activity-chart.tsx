"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface LearningActivityChartProps {
  data: Array<{
    label: string;
    hours: number;
  }>;
}

const chartConfig = {
  hours: {
    label: "Hours",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

/**
 * Compact bar chart showing weekly learning hours for the last few reports.
 * Styled to design tokens. Empty data is handled by the parent (the chart
 * only renders when there is at least one data point).
 */
export function LearningActivityChart({ data }: LearningActivityChartProps) {
  return (
    <ChartContainer
      config={chartConfig}
      className="h-[180px] w-full !aspect-auto"
    >
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        accessibilityLayer
      >
        <CartesianGrid
          vertical={false}
          strokeDasharray="3 3"
          className="stroke-border/60"
        />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={{ fontSize: 11 }}
          className="fill-muted-foreground"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          width={28}
          allowDecimals={false}
          tick={{ fontSize: 11 }}
          className="fill-muted-foreground"
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => (
                <span className="nums font-medium tabular-nums">
                  {value}h
                </span>
              )}
            />
          }
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
        />
        <Bar
          dataKey="hours"
          fill="var(--color-hours)"
          radius={[3, 3, 0, 0]}
          maxBarSize={36}
        />
      </BarChart>
    </ChartContainer>
  );
}

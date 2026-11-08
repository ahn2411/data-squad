"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface TeamProgressChartProps {
  data: Array<{
    label: string;
    ratio: number; // 0..1
  }>;
}

const chartConfig = {
  ratio: {
    label: "Roadmap progress",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

/**
 * Per-member roadmap progress (%) bar chart for admin/leader dashboard.
 * Renders only when there is at least one member. Empty state handled by parent.
 */
export function TeamProgressChart({ data }: TeamProgressChartProps) {
  return (
    <ChartContainer
      config={chartConfig}
      className="h-[220px] w-full !aspect-auto"
    >
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
        accessibilityLayer
      >
        <CartesianGrid
          horizontal={false}
          strokeDasharray="3 3"
          className="stroke-border/60"
        />
        <XAxis
          type="number"
          domain={[0, 1]}
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
          className="fill-muted-foreground"
        />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={120}
          tick={{ fontSize: 12 }}
          className="fill-muted-foreground"
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => (
                <span className="nums font-medium tabular-nums">
                  {Math.round(Number(value) * 100)}%
                </span>
              )}
            />
          }
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
        />
        <Bar dataKey="ratio" radius={[0, 4, 4, 0]} maxBarSize={24}>
          {data.map((entry, idx) => (
            <Cell
              key={`cell-${idx}`}
              fill="var(--color-ratio)"
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

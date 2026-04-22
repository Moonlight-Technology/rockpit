"use client";

import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type TaskDatePickerTarget = "start" | "due";

export type TaskDatePickerValue = {
  startDate: string;
  dueDate: string;
  useDateRange: boolean;
  useTimeRange: boolean;
  startTime: string;
  endTime: string;
};

type TaskDatePickerPanelProps = {
  value: TaskDatePickerValue;
  target: TaskDatePickerTarget;
  onTargetChange: (target: TaskDatePickerTarget) => void;
  onChange: (next: TaskDatePickerValue) => void;
  onCancel: () => void;
  onConfirm: () => void;
  title?: string;
  className?: string;
};

function toDate(value: string) {
  return value ? new Date(`${value}T00:00:00`) : undefined;
}

export function TaskDatePickerPanel({
  value,
  target,
  onTargetChange,
  onChange,
  onCancel,
  onConfirm,
  title = "Dates",
  className,
}: TaskDatePickerPanelProps) {
  return (
    <Card className={cn("w-full lg:w-[22rem]", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2">
          {value.useDateRange ? (
            <div
              className={`grid w-full min-w-[18rem] grid-cols-[1fr_auto] items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm ${
                target === "start" ? "border-primary bg-primary/10" : "bg-muted/40"
              }`}
            >
              <button type="button" onClick={() => onTargetChange("start")} className="text-left">
                {value.startDate ? format(new Date(`${value.startDate}T00:00:00`), "PP") : "Select start date"}
              </button>
              {value.useTimeRange ? (
                <input
                  type="time"
                  value={value.startTime}
                  onChange={(event) => onChange({ ...value, startTime: event.target.value })}
                  className="h-8 rounded-md border bg-background px-2 text-xs"
                />
              ) : null}
            </div>
          ) : null}
          <div
            className={`grid w-full min-w-[18rem] grid-cols-[1fr_auto] items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm ${
              target === "due" ? "border-primary bg-primary/10" : "bg-muted/40"
            }`}
          >
            <button type="button" onClick={() => onTargetChange("due")} className="text-left">
              {value.dueDate ? format(new Date(`${value.dueDate}T00:00:00`), "PP") : "Select due date"}
            </button>
            {value.useTimeRange ? (
              <input
                type="time"
                value={value.useDateRange ? value.endTime : value.startTime}
                onChange={(event) =>
                  onChange({
                    ...value,
                    ...(value.useDateRange
                      ? { endTime: event.target.value }
                      : { startTime: event.target.value }),
                  })
                }
                className="h-8 rounded-md border bg-background px-2 text-xs"
              />
            ) : null}
          </div>
        </div>

        <Calendar
          mode="single"
          selected={target === "start" ? toDate(value.startDate) : toDate(value.dueDate)}
          onSelect={(date) => {
            if (!date) return;
            const next = format(date, "yyyy-MM-dd");
            onChange({
              ...value,
              ...(target === "start" ? { startDate: next } : { dueDate: next }),
            });
          }}
          className="w-full"
        />

        <div className="space-y-2 border-t pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Options</p>
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox
              checked={value.useDateRange}
              onCheckedChange={(checked) => {
                const enabled = checked === true;
                onChange({
                  ...value,
                  useDateRange: enabled,
                  startDate: enabled ? value.startDate || value.dueDate : "",
                });
                if (!enabled) {
                  onTargetChange("due");
                }
              }}
            />
            Start date
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox
              checked={value.useTimeRange}
              onCheckedChange={(checked) =>
                onChange({
                  ...value,
                  useTimeRange: checked === true,
                })
              }
            />
            Include time
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t pt-3">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={onConfirm}>
            OK
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  HelicopterDashboardTask,
  RiskBucket,
  RiskBucketId,
} from "@/lib/helicopter-dashboard";

type RiskTimelinePanelProps = {
  buckets: RiskBucket[];
  selectedBucketId: RiskBucketId;
  onSelectBucket: (bucketId: RiskBucketId) => void;
  onOpenTask: (task: HelicopterDashboardTask) => void;
};

const bucketTone: Record<RiskBucketId, string> = {
  today: "border-red-300/80 bg-red-50/80",
  tomorrow: "border-amber-300/80 bg-amber-50/80",
  next3Days: "border-sky-300/80 bg-sky-50/80",
};

export function RiskTimelinePanel({
  buckets,
  selectedBucketId,
  onSelectBucket,
  onOpenTask,
}: RiskTimelinePanelProps) {
  const selectedBucket = buckets.find((bucket) => bucket.id === selectedBucketId) ?? buckets[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk Timeline</CardTitle>
        <CardDescription>Short-horizon task risk across all work.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          {buckets.map((bucket) => (
            <button
              key={bucket.id}
              type="button"
              onClick={() => onSelectBucket(bucket.id)}
              className={`rounded-xl border p-3 text-left transition hover:shadow-sm ${bucketTone[bucket.id]} ${
                selectedBucketId === bucket.id ? "ring-2 ring-zinc-900/15" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{bucket.label}</span>
                <Badge variant="secondary">{bucket.count}</Badge>
              </div>
              <div className="mt-2 space-y-1">
                {bucket.preview.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No due-soon tasks.</p>
                ) : (
                  bucket.preview.slice(0, 3).map((task) => (
                    <p key={task.id} className="truncate text-xs text-muted-foreground">
                      {task.title}
                    </p>
                  ))
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <div>
            <h3 className="text-sm font-medium">{selectedBucket.label}</h3>
            <p className="text-xs text-muted-foreground">Open a task to inspect or edit it.</p>
          </div>

          {selectedBucket.tasks.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
              No tasks in this bucket.
            </div>
          ) : (
            selectedBucket.tasks.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => onOpenTask(task)}
                className="flex w-full flex-col rounded-lg border bg-card px-4 py-3 text-left transition hover:bg-muted/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium">{task.title}</span>
                  <Badge
                    variant={
                      task.priority === "HIGH"
                        ? "destructive"
                        : task.priority === "MEDIUM"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {task.priority}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {task.board?.title ?? "Personal"}
                  {task.column ? ` • ${task.column.title}` : ""}
                  {task.dueDate ? ` • Due ${format(new Date(task.dueDate), "MMM d")}` : ""}
                </p>
              </button>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

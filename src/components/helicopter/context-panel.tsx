import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  CompletionSnapshotRow,
  OverloadProjectRow,
  SignalSummary,
} from "@/lib/helicopter-dashboard";

type ContextPanelProps = {
  overloadProjects: OverloadProjectRow[];
  completionSnapshot: CompletionSnapshotRow[];
  signalSummary: SignalSummary;
  onOpenSection: (sectionId: string) => void;
};

export function ContextPanel({
  overloadProjects,
  completionSnapshot,
  signalSummary,
  onOpenSection,
}: ContextPanelProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Overload Projects</CardTitle>
          <CardDescription>Boards with the highest due-soon concentration.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {overloadProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No board deadlines in the next 3 days.</p>
          ) : (
            overloadProjects.slice(0, 4).map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => onOpenSection(row.id)}
                className="block w-full rounded-lg border bg-card px-3 py-2 text-left transition hover:bg-muted/30"
              >
                <p className="text-sm font-medium">{row.title}</p>
                <p className="text-xs text-muted-foreground">
                  Due soon {row.dueSoonCount} • Open {row.openCount}
                </p>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Completion Snapshot</CardTitle>
          <CardDescription>Open vs done for the busiest work areas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {completionSnapshot.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => onOpenSection(row.id)}
              className="block w-full rounded-lg border bg-card px-3 py-2 text-left transition hover:bg-muted/30"
            >
              <p className="text-sm font-medium">{row.title}</p>
              <p className="text-xs text-muted-foreground">
                Open {row.openCount} • Done {row.doneCount}
              </p>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Signal Summary</CardTitle>
          <CardDescription>Quick workload totals across personal and board tasks.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg border bg-card px-3 py-2">
            <p className="text-xs text-muted-foreground">Open</p>
            <p className="font-medium">{signalSummary.openCount}</p>
          </div>
          <div className="rounded-lg border bg-card px-3 py-2">
            <p className="text-xs text-muted-foreground">Due Soon</p>
            <p className="font-medium">{signalSummary.dueSoonCount}</p>
          </div>
          <div className="rounded-lg border bg-card px-3 py-2">
            <p className="text-xs text-muted-foreground">Personal</p>
            <p className="font-medium">{signalSummary.personalCount}</p>
          </div>
          <div className="rounded-lg border bg-card px-3 py-2">
            <p className="text-xs text-muted-foreground">Board</p>
            <p className="font-medium">{signalSummary.boardCount}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

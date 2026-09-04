"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { analyzeCriticalPath, buildNetworkLayout, type DependencyEdge, type DependencyTask } from "@/lib/critical-path";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type CriticalPathTask = DependencyTask & {
  dependencies: Array<{ dependsOnTaskId: string }>;
};

export function CriticalPathPanel({
  tasks,
  onSave,
}: {
  tasks: CriticalPathTask[];
  onSave: (taskId: string, dependsOnTaskIds: string[]) => Promise<{ error?: string }>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const edges = useMemo<DependencyEdge[]>(() => tasks.flatMap((task) => task.dependencies.map((dependency) => ({ taskId: task.id, dependsOnTaskId: dependency.dependsOnTaskId }))), [tasks]);
  const analysis = useMemo(() => analyzeCriticalPath(tasks, edges), [tasks, edges]);
  const layout = useMemo(() => buildNetworkLayout(tasks, edges), [tasks, edges]);
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

  const save = async (formData: FormData) => {
    if (!editingId) return;
    setSaving(true);
    setError(null);
    const result = await onSave(editingId, formData.getAll("dependency").map(String));
    setSaving(false);
    if (result.error) setError(result.error);
    else setEditingId(null);
  };

  return <Tabs defaultValue="dependencies" className="space-y-4">
    <TabsList><TabsTrigger value="dependencies">Task Dependencies</TabsTrigger><TabsTrigger value="network">Network Diagram</TabsTrigger></TabsList>
    <TabsContent value="dependencies">
      <div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-3">Task</th><th className="p-3">Start</th><th className="p-3">Due</th><th className="p-3">Dependency</th></tr></thead><tbody>{tasks.map((task) => <tr key={task.id} className="border-b last:border-0"><td className="p-3 font-medium">{task.title}</td><td className="p-3">{task.startDate ? format(new Date(task.startDate), "MMM d, yyyy") : "-"}</td><td className="p-3">{task.dueDate ? format(new Date(task.dueDate), "MMM d, yyyy") : "-"}</td><td className="p-3">{editingId === task.id ? <form action={save} className="space-y-2"><select name="dependency" multiple defaultValue={task.dependencies.map((dependency) => dependency.dependsOnTaskId)} className="min-h-24 w-full rounded border bg-background p-2">{tasks.filter((candidate) => candidate.id !== task.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title}</option>)}</select>{error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}<div className="flex gap-2"><button disabled={saving} className="rounded bg-primary px-2 py-1 text-primary-foreground">Save dependencies</button><button type="button" onClick={() => setEditingId(null)} className="rounded border px-2 py-1">Cancel</button></div></form> : <button onClick={() => setEditingId(task.id)} className="text-left hover:underline">{task.dependencies.length ? task.dependencies.map((dependency) => taskById.get(dependency.dependsOnTaskId)?.title).join(", ") : "None"}</button>}</td></tr>)}</tbody></table></div>
    </TabsContent>
    <TabsContent value="network"><div className="space-y-3 rounded-lg border bg-card p-4"><div className="flex flex-wrap gap-4 text-sm"><span>Critical path: <strong>{analysis.projectDurationDays} days</strong></span><span>{analysis.criticalTaskIds.size} critical tasks</span><span>{analysis.excludedTaskIds.size} missing dates</span></div>{tasks.length === 0 ? <p className="text-sm text-muted-foreground">No tasks in this board.</p> : <div className="overflow-auto"><svg role="img" aria-label="Task dependency network" viewBox={`0 0 ${layout.width} ${layout.height}`} className="min-w-[600px] rounded bg-slate-50"><defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" /></marker></defs>{edges.map((edge) => { const from = layout.nodes[edge.dependsOnTaskId]; const to = layout.nodes[edge.taskId]; if (!from || !to) return null; const critical = analysis.criticalEdgeKeys.has(`${edge.dependsOnTaskId}:${edge.taskId}`); return <line key={`${edge.dependsOnTaskId}:${edge.taskId}`} x1={from.x + 190} y1={from.y + 38} x2={to.x} y2={to.y + 38} stroke={critical ? "#dc2626" : "#64748b"} strokeWidth={critical ? 3 : 1.5} markerEnd="url(#arrow)" />; })}{tasks.map((task) => { const node = layout.nodes[task.id]; if (!node) return null; const critical = analysis.criticalTaskIds.has(task.id); return <g key={task.id} transform={`translate(${node.x},${node.y})`}><rect width="190" height="76" rx="8" fill={critical ? "#fef2f2" : "white"} stroke={critical ? "#dc2626" : "#94a3b8"} strokeWidth={critical ? 2 : 1} /><text x="12" y="27" fontSize="13" fontWeight="600">{task.title.slice(0, 24)}</text><text x="12" y="49" fontSize="11" fill="#64748b">{task.startDate && task.dueDate ? `${format(new Date(task.startDate), "MMM d")} - ${format(new Date(task.dueDate), "MMM d")}` : "Missing dates"}</text><text x="12" y="66" fontSize="11" fill="#64748b">{critical ? "Critical" : `${analysis.slackDaysByTaskId[task.id] ?? "-"} days slack`}</text></g>; })}</svg></div>}</div></TabsContent>
  </Tabs>;
}

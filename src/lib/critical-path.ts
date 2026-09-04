import { differenceInCalendarDays } from "date-fns";

export type DependencyTask = {
  id: string;
  title: string;
  status: "TODO" | "DONE";
  startDate: string | null;
  dueDate: string | null;
};

export type DependencyEdge = {
  taskId: string;
  dependsOnTaskId: string;
};

export type CriticalPathAnalysis = {
  criticalTaskIds: Set<string>;
  criticalEdgeKeys: Set<string>;
  projectDurationDays: number;
  slackDaysByTaskId: Record<string, number>;
  excludedTaskIds: Set<string>;
};

export type NetworkLayout = {
  nodes: Record<string, { x: number; y: number; layer: number }>;
  width: number;
  height: number;
};

function getDurationDays(task: DependencyTask) {
  if (!task.startDate || !task.dueDate) return null;
  return Math.max(1, differenceInCalendarDays(new Date(task.dueDate), new Date(task.startDate)) + 1);
}

export function hasDependencyCycle(taskIds: string[], edges: DependencyEdge[]) {
  const taskIdSet = new Set(taskIds);
  const inDegree = new Map(taskIds.map((taskId) => [taskId, 0]));
  const dependents = new Map(taskIds.map((taskId) => [taskId, [] as string[]]));

  for (const edge of edges) {
    if (!taskIdSet.has(edge.taskId) || !taskIdSet.has(edge.dependsOnTaskId)) continue;
    dependents.get(edge.dependsOnTaskId)?.push(edge.taskId);
    inDegree.set(edge.taskId, (inDegree.get(edge.taskId) ?? 0) + 1);
  }

  const queue = taskIds.filter((taskId) => inDegree.get(taskId) === 0);
  let visited = 0;
  while (queue.length > 0) {
    const taskId = queue.shift() as string;
    visited += 1;
    for (const dependentId of dependents.get(taskId) ?? []) {
      const remaining = (inDegree.get(dependentId) ?? 0) - 1;
      inDegree.set(dependentId, remaining);
      if (remaining === 0) queue.push(dependentId);
    }
  }

  return visited !== taskIds.length;
}

export function getDependencyCandidateIds(
  taskId: string,
  taskIds: string[],
  existingEdges: DependencyEdge[]
) {
  return new Set(
    taskIds.filter(
      (candidateId) =>
        candidateId !== taskId &&
        !hasDependencyCycle(taskIds, [
          ...existingEdges.filter((edge) => edge.taskId !== taskId),
          { taskId, dependsOnTaskId: candidateId },
        ])
    )
  );
}

export function buildNetworkLayout(tasks: DependencyTask[], edges: DependencyEdge[]): NetworkLayout {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const predecessors = new Map(tasks.map((task) => [task.id, [] as string[]]));
  const dependents = new Map(tasks.map((task) => [task.id, [] as string[]]));
  const inDegree = new Map(tasks.map((task) => [task.id, 0]));

  for (const edge of edges) {
    if (!taskById.has(edge.taskId) || !taskById.has(edge.dependsOnTaskId)) continue;
    predecessors.get(edge.taskId)?.push(edge.dependsOnTaskId);
    dependents.get(edge.dependsOnTaskId)?.push(edge.taskId);
    inDegree.set(edge.taskId, (inDegree.get(edge.taskId) ?? 0) + 1);
  }

  const layerByTaskId = new Map<string, number>();
  const queue = tasks
    .filter((task) => inDegree.get(task.id) === 0)
    .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
    .map((task) => task.id);

  while (queue.length > 0) {
    const taskId = queue.shift() as string;
    const predecessorLayers = (predecessors.get(taskId) ?? []).map(
      (predecessorId) => layerByTaskId.get(predecessorId) ?? 0
    );
    const layer = predecessorLayers.length ? Math.max(...predecessorLayers) + 1 : 0;
    layerByTaskId.set(taskId, layer);

    for (const dependentId of dependents.get(taskId) ?? []) {
      const remaining = (inDegree.get(dependentId) ?? 0) - 1;
      inDegree.set(dependentId, remaining);
      if (remaining === 0) queue.push(dependentId);
    }
  }

  for (const task of tasks) {
    if (!layerByTaskId.has(task.id)) layerByTaskId.set(task.id, 0);
  }

  const tasksByLayer = new Map<number, DependencyTask[]>();
  for (const task of tasks) {
    const layer = layerByTaskId.get(task.id) ?? 0;
    const layerTasks = tasksByLayer.get(layer) ?? [];
    layerTasks.push(task);
    tasksByLayer.set(layer, layerTasks);
  }

  const nodes: NetworkLayout["nodes"] = {};
  const horizontalGap = 280;
  const verticalGap = 132;
  const maxLayer = Math.max(0, ...tasksByLayer.keys());
  let maxRows = 1;
  for (const [layer, layerTasks] of tasksByLayer) {
    layerTasks.sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
    maxRows = Math.max(maxRows, layerTasks.length);
    layerTasks.forEach((task, index) => {
      nodes[task.id] = { x: 36 + layer * horizontalGap, y: 36 + index * verticalGap, layer };
    });
  }

  return {
    nodes,
    width: 260 + maxLayer * horizontalGap,
    height: 112 + (maxRows - 1) * verticalGap,
  };
}

export function analyzeCriticalPath(
  tasks: DependencyTask[],
  edges: DependencyEdge[]
): CriticalPathAnalysis {
  const durations = new Map<string, number>();
  const excludedTaskIds = new Set<string>();

  for (const task of tasks) {
    const duration = getDurationDays(task);
    if (duration === null) {
      excludedTaskIds.add(task.id);
    } else {
      durations.set(task.id, duration);
    }
  }

  const includedIds = new Set(durations.keys());
  const includedEdges = edges.filter(
    (edge) => includedIds.has(edge.taskId) && includedIds.has(edge.dependsOnTaskId)
  );
  const predecessors = new Map<string, string[]>();
  const dependents = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const taskId of includedIds) {
    predecessors.set(taskId, []);
    dependents.set(taskId, []);
    inDegree.set(taskId, 0);
  }

  for (const edge of includedEdges) {
    predecessors.get(edge.taskId)?.push(edge.dependsOnTaskId);
    dependents.get(edge.dependsOnTaskId)?.push(edge.taskId);
    inDegree.set(edge.taskId, (inDegree.get(edge.taskId) ?? 0) + 1);
  }

  const queue = Array.from(includedIds).filter((taskId) => inDegree.get(taskId) === 0);
  const orderedIds: string[] = [];

  while (queue.length > 0) {
    const taskId = queue.shift() as string;
    orderedIds.push(taskId);
    for (const dependentId of dependents.get(taskId) ?? []) {
      const remaining = (inDegree.get(dependentId) ?? 0) - 1;
      inDegree.set(dependentId, remaining);
      if (remaining === 0) queue.push(dependentId);
    }
  }

  const earliestFinish = new Map<string, number>();
  for (const taskId of orderedIds) {
    const predecessorFinish = Math.max(
      0,
      ...(predecessors.get(taskId) ?? []).map((predecessorId) => earliestFinish.get(predecessorId) ?? 0)
    );
    earliestFinish.set(taskId, predecessorFinish + (durations.get(taskId) ?? 0));
  }

  const projectDurationDays = Math.max(0, ...earliestFinish.values());
  const latestFinish = new Map<string, number>();
  const slackDaysByTaskId: Record<string, number> = {};

  for (const taskId of [...orderedIds].reverse()) {
    const nextTasks = dependents.get(taskId) ?? [];
    const latest = nextTasks.length
      ? Math.min(
          ...nextTasks.map(
            (dependentId) =>
              (latestFinish.get(dependentId) ?? projectDurationDays) -
              (durations.get(dependentId) ?? 0)
          )
        )
      : projectDurationDays;
    latestFinish.set(taskId, latest);
    slackDaysByTaskId[taskId] = latest - (durations.get(taskId) ?? 0) - (earliestFinish.get(taskId) ?? 0) + (durations.get(taskId) ?? 0);
  }

  const criticalTaskIds = new Set(
    orderedIds.filter((taskId) => slackDaysByTaskId[taskId] === 0)
  );
  const criticalEdgeKeys = new Set(
    includedEdges
      .filter(
        (edge) => criticalTaskIds.has(edge.taskId) && criticalTaskIds.has(edge.dependsOnTaskId)
      )
      .map((edge) => `${edge.dependsOnTaskId}:${edge.taskId}`)
  );

  return {
    criticalTaskIds,
    criticalEdgeKeys,
    projectDurationDays,
    slackDaysByTaskId,
    excludedTaskIds,
  };
}

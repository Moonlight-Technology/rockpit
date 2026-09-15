export type NetworkPosition = {
  x: number;
  y: number;
};

export type StoredNetworkPosition = NetworkPosition & {
  taskId: string;
};

export type NetworkLayoutNode = NetworkPosition & {
  layer: number;
};

const MAX_NETWORK_COORDINATE = 20_000;
const NODE_RIGHT_MARGIN = 224;
const NODE_BOTTOM_MARGIN = 76;

export function clampNetworkPosition({ x, y }: NetworkPosition): NetworkPosition {
  return {
    x: Math.max(0, Math.min(MAX_NETWORK_COORDINATE, Math.round(x))),
    y: Math.max(0, Math.min(MAX_NETWORK_COORDINATE, Math.round(y))),
  };
}

export function mergeNetworkNodePositions(
  autoNodes: Record<string, NetworkLayoutNode>,
  savedPositions: StoredNetworkPosition[],
): Record<string, NetworkLayoutNode> {
  const savedByTaskId = new Map(
    savedPositions.map((position) => [position.taskId, position]),
  );

  return Object.fromEntries(
    Object.entries(autoNodes).map(([taskId, node]) => {
      const saved = savedByTaskId.get(taskId);
      return [taskId, saved ? { ...node, x: saved.x, y: saved.y } : node];
    }),
  );
}

export function getNetworkCanvasBounds(nodes: Record<string, NetworkLayoutNode>) {
  const positions = Object.values(nodes);
  if (!positions.length) return { width: 260, height: 112 };

  return {
    width: Math.max(260, ...positions.map((node) => node.x + NODE_RIGHT_MARGIN)),
    height: Math.max(112, ...positions.map((node) => node.y + NODE_BOTTOM_MARGIN)),
  };
}

export function isNetworkNodeDrag(start: NetworkPosition, current: NetworkPosition) {
  return Math.hypot(current.x - start.x, current.y - start.y) >= 4;
}

export function toNetworkPositionMap(positions: StoredNetworkPosition[]) {
  return Object.fromEntries(
    positions.map(({ taskId, x, y }) => [taskId, { x, y }]),
  ) as Record<string, NetworkPosition>;
}

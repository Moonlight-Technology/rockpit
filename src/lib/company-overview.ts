export function groupLeadsByColumn(
  columns: Array<{ id: string; title: string; position: number }>,
  leads: Array<{ id: string; columnId: string; estimatedValue: number }>
) {
  return [...columns]
    .sort((a, b) => a.position - b.position)
    .map((column) => {
      const columnLeads = leads.filter((lead) => lead.columnId === column.id);
      return {
        ...column,
        leads: columnLeads,
        totalEstimatedValue: columnLeads.reduce(
          (sum, lead) => sum + lead.estimatedValue,
          0
        ),
      };
    });
}

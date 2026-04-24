import PDFDocument from "pdfkit";
import { getSessionUserId, notFound, unauthorized } from "@/lib/api";
import { getBoardDetailForUser } from "@/lib/board-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BoardData = NonNullable<Awaited<ReturnType<typeof getBoardDetailForUser>>>;
type BoardTask = BoardData["columns"][number]["tasks"][number];

function asDate(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function formatDateTime(value: Date | string | null | undefined) {
  const date = asDate(value);
  if (!date) return "-";
  return date.toLocaleString();
}

function formatDateOnly(value: Date | string | null | undefined) {
  const date = asDate(value);
  if (!date) return "-";
  return date.toLocaleDateString();
}

function formatTimeRange(task: BoardTask) {
  const start = asDate(task.plannedStartAt);
  if (!start) return "-";
  const durationMinutes = task.plannedDurationMinutes ?? 60;
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return `${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function getAssigneeNames(task: BoardTask) {
  if (task.assignees?.length) {
    return task.assignees.map((item) => item.user.name).join(", ");
  }
  if (task.assignee) {
    return task.assignee.name;
  }
  return "-";
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + height <= bottom) return;
  doc.addPage();
}

function parseFileName(boardTitle: string) {
  const safeTitle = boardTitle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const date = new Date().toISOString().slice(0, 10);
  return `rockpit-board-report-${safeTitle || "board"}-${date}.pdf`;
}

function drawSummaryTable(doc: PDFKit.PDFDocument, tasks: BoardTask[], contentWidth: number) {
  const columns = [
    { key: "title", label: "Task", width: contentWidth * 0.30 },
    { key: "status", label: "Status", width: contentWidth * 0.12 },
    { key: "priority", label: "Priority", width: contentWidth * 0.12 },
    { key: "due", label: "Due Date", width: contentWidth * 0.20 },
    { key: "assignees", label: "Assignees", width: contentWidth * 0.26 },
  ] as const;

  ensureSpace(doc, 26);
  const headerTop = doc.y;
  doc
    .rect(doc.page.margins.left, headerTop, contentWidth, 22)
    .fill("#F3F4F6");
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(9);
  let x = doc.page.margins.left + 6;
  for (const column of columns) {
    doc.text(column.label, x, headerTop + 7, {
      width: column.width - 10,
      lineBreak: false,
      ellipsis: true,
    });
    x += column.width;
  }
  doc.y = headerTop + 24;

  doc.fillColor("#111827").font("Helvetica").fontSize(9);
  for (const task of tasks) {
    ensureSpace(doc, 20);
    const rowTop = doc.y;
    doc
      .rect(doc.page.margins.left, rowTop, contentWidth, 18)
      .strokeColor("#E5E7EB")
      .lineWidth(0.5)
      .stroke();

    const rowValues = [
      task.title,
      task.status,
      task.priority,
      formatDateOnly(task.dueDate),
      getAssigneeNames(task),
    ];

    let rowX = doc.page.margins.left + 6;
    rowValues.forEach((value, index) => {
      const column = columns[index];
      doc.text(value, rowX, rowTop + 5, {
        width: column.width - 10,
        lineBreak: false,
        ellipsis: true,
      });
      rowX += column.width;
    });

    doc.y = rowTop + 19;
  }
}

function drawTaskDetails(doc: PDFKit.PDFDocument, tasks: BoardTask[], contentWidth: number) {
  for (const task of tasks) {
    ensureSpace(doc, 120);
    const boxTop = doc.y;
    doc
      .roundedRect(doc.page.margins.left, boxTop, contentWidth, 106, 6)
      .fill("#FAFAFA");

    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(11);
    doc.text(task.title, doc.page.margins.left + 10, boxTop + 9, {
      width: contentWidth - 20,
      ellipsis: true,
      lineBreak: false,
    });

    doc.fillColor("#4B5563").font("Helvetica").fontSize(9);
    doc.text(
      task.description?.trim() ? task.description : "No description.",
      doc.page.margins.left + 10,
      boxTop + 24,
      {
        width: contentWidth - 20,
        height: 24,
        ellipsis: true,
      }
    );

    const metadata = [
      `Status: ${task.status}`,
      `Priority: ${task.priority}`,
      `Assignees: ${getAssigneeNames(task)}`,
      `Start: ${formatDateTime(task.startDate)}`,
      `Due: ${formatDateTime(task.dueDate)}`,
      `Time Range: ${formatTimeRange(task)}`,
    ];

    let metaY = boxTop + 52;
    for (const item of metadata) {
      doc.text(item, doc.page.margins.left + 10, metaY, {
        width: contentWidth - 20,
        lineBreak: false,
        ellipsis: true,
      });
      metaY += 9;
    }

    doc.y = boxTop + 114;
  }
}

function buildPdf(board: BoardData) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
      info: {
        Title: `RockPit Report - ${board.title}`,
        Author: "RockPit",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(20).text("Board Report");
    doc.moveDown(0.2);
    doc.fontSize(14).text(board.title);
    doc.font("Helvetica").fontSize(10).fillColor("#4B5563");
    doc.text(`Generated: ${new Date().toLocaleString()}`);
    doc.text(`Theme: ${board.theme}`);
    doc.text(`Due date: ${formatDateOnly(board.dueDate)}`);
    doc.text(`Tags: ${board.tags.length ? board.tags.join(", ") : "-"}`);
    doc.moveDown(0.4);
    doc.text(`Description: ${board.description || "-"}`, {
      width: contentWidth,
    });
    doc.moveDown(0.8);

    for (const column of board.columns) {
      ensureSpace(doc, 44);
      doc
        .roundedRect(doc.page.margins.left, doc.y, contentWidth, 26, 6)
        .fill("#E5E7EB");
      doc.fillColor("#111827").font("Helvetica-Bold").fontSize(12);
      doc.text(
        `${column.title}  (${column.tasks.length} task${column.tasks.length === 1 ? "" : "s"})`,
        doc.page.margins.left + 10,
        doc.y - 20
      );
      doc.moveDown(0.6);

      if (!column.tasks.length) {
        ensureSpace(doc, 22);
        doc.font("Helvetica-Oblique").fontSize(10).fillColor("#6B7280");
        doc.text("No tasks in this column.");
        doc.moveDown(0.6);
        continue;
      }

      drawSummaryTable(doc, column.tasks, contentWidth);
      doc.moveDown(0.5);
      ensureSpace(doc, 24);
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#111827").text("Task Details");
      doc.moveDown(0.2);
      drawTaskDetails(doc, column.tasks, contentWidth);
      doc.moveDown(0.6);
    }

    doc.end();
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const { id: boardId } = await params;
  const board = await getBoardDetailForUser(userId, boardId);
  if (!board) return notFound("Board not found.");

  const pdfBuffer = await buildPdf(board);
  const fileName = parseFileName(board.title);

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}


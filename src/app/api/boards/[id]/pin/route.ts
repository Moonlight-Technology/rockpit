import { NextResponse } from "next/server";
import { getSessionUserId, unauthorized, validationError } from "@/lib/api";
import { setBoardPinForUser } from "@/lib/board-service";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { id: boardId } = await params;
  const payload = await req.json().catch(() => null);
  const action = payload?.action;
  const replaceBoardId = payload?.replaceBoardId;
  if (action !== "pin" && action !== "unpin") {
    return validationError("Invalid action. Use pin or unpin.");
  }

  const result = await setBoardPinForUser({
    userId,
    boardId,
    pin: action === "pin",
    replaceBoardId: typeof replaceBoardId === "string" ? replaceBoardId : null,
  });

  if ("error" in result) {
    if (result.error === "PIN_LIMIT") {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "PIN_LIMIT",
            message: "Pin limit reached.",
          },
          data: {
            pinnedBoards: result.pinnedBoards ?? [],
          },
        },
        { status: 409 }
      );
    }

    if (result.error === "REPLACE_NOT_PINNED") {
      return validationError("Selected board to replace is not pinned.");
    }

    return NextResponse.json(
      { ok: false, error: { code: "NOT_FOUND", message: "Board not found." } },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}


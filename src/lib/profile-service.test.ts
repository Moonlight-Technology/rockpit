import assert from "node:assert/strict";
import { test } from "vitest";
import { updateProfileWithDependencies } from "./profile-service.ts";

test("updateProfileWithDependencies saves the validated profile for the signed-in user", async () => {
  const calls: unknown[] = [];
  const result = await updateProfileWithDependencies(
    {
      userId: "user-1",
      payload: { name: "  Firhat Hidayat ", avatarColor: "#E76F51" },
    },
    {
      prisma: {
        user: {
          update: async (args: unknown) => {
            calls.push(args);
            return { id: "user-1", name: "Firhat Hidayat", email: "firhat@example.com", avatarColor: "#E76F51" };
          },
        },
      },
    }
  );

  assert.deepEqual(calls, [
    {
      where: { id: "user-1" },
      data: { name: "Firhat Hidayat", avatarColor: "#E76F51" },
      select: { id: true, name: true, email: true, avatarColor: true },
    },
  ]);
  assert.deepEqual(result, {
    data: { id: "user-1", name: "Firhat Hidayat", email: "firhat@example.com", avatarColor: "#E76F51" },
  });
});

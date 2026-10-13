import assert from "node:assert/strict";
import { test } from "vitest";
import { updateProfileSchema } from "./profile.ts";

test("updateProfileSchema trims a valid name and preserves a warm avatar color", () => {
  const parsed = updateProfileSchema.parse({
    name: "  Firhat Hidayat  ",
    avatarColor: "#E76F51",
  });

  assert.deepEqual(parsed, {
    name: "Firhat Hidayat",
    avatarColor: "#E76F51",
  });
});

test("updateProfileSchema rejects non-warm avatar colors", () => {
  assert.throws(
    () => updateProfileSchema.parse({ name: "Firhat", avatarColor: "#2563EB" }),
    /warm/i
  );
});

test("updateProfileSchema rejects a name shorter than two characters", () => {
  assert.throws(() => updateProfileSchema.parse({ name: "F", avatarColor: "#F4A261" }));
});

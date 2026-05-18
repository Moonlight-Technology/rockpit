import assert from "node:assert/strict";
import test from "node:test";
import { createClientSchema, updateClientSchema } from "./company-client.ts";

test("createClientSchema trims client fields and defaults optional strings", () => {
  const parsed = createClientSchema.parse({
    name: "  Jane Doe  ",
    email: " jane@example.com ",
    phone: " 08123456789 ",
    companyName: " PT Jane ",
    address: " Jakarta ",
    notes: " Preferred contact: email ",
  });

  assert.deepEqual(parsed, {
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "08123456789",
    companyName: "PT Jane",
    address: "Jakarta",
    notes: "Preferred contact: email",
  });
});

test("createClientSchema accepts name-only clients", () => {
  const parsed = createClientSchema.parse({ name: "Acme" });

  assert.deepEqual(parsed, {
    name: "Acme",
    email: "",
    phone: "",
    companyName: "",
    address: "",
    notes: "",
  });
});

test("updateClientSchema requires at least one field", () => {
  assert.throws(() => updateClientSchema.parse({}), /At least one field is required/);
});

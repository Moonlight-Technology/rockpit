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

test("createClientSchema accepts required fields with optional strings omitted", () => {
  const parsed = createClientSchema.parse({ name: "Acme", companyName: "Acme Corp" });

  assert.deepEqual(parsed, {
    name: "Acme",
    email: "",
    phone: "",
    companyName: "Acme Corp",
    address: "",
    notes: "",
  });
});

test("createClientSchema requires company name", () => {
  assert.throws(() => createClientSchema.parse({ name: "Acme" }));
});

test("updateClientSchema requires at least one field", () => {
  assert.throws(() => updateClientSchema.parse({}), /At least one field is required/);
});

test("updateClientSchema accepts partial optional fields", () => {
  assert.deepEqual(updateClientSchema.parse({ phone: " 08123456789 " }), {
    phone: "08123456789",
  });
});

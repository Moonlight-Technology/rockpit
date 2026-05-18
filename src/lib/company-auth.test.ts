import assert from "node:assert/strict";
import test from "node:test";
import { canOpenCompanyShell } from "./company-auth.ts";

test("canOpenCompanyShell allows premium owners", () => {
  assert.equal(
    canOpenCompanyShell({ isOwner: true, hasPremiumUnlock: true, invitedLeadBoardIds: [] }),
    true
  );
});

test("canOpenCompanyShell allows invited non-premium collaborators", () => {
  assert.equal(
    canOpenCompanyShell({
      isOwner: false,
      hasPremiumUnlock: false,
      invitedLeadBoardIds: ["lead-board-1"],
    }),
    true
  );
});

test("canOpenCompanyShell allows invited premium collaborators", () => {
  assert.equal(
    canOpenCompanyShell({
      isOwner: false,
      hasPremiumUnlock: true,
      invitedLeadBoardIds: ["lead-board-1"],
    }),
    true
  );
});

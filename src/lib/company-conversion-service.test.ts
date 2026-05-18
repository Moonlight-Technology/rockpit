import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import {
  canConvertLeadToProject,
  convertLeadToProjectWithDependencies,
} from "./company-conversion-service.ts";

function createTransactionRunner(tx: unknown) {
  return async <T>(fn: (client: Prisma.TransactionClient) => Promise<T>) =>
    fn(tx as Prisma.TransactionClient);
}

test("canConvertLeadToProject allows won leads that have not been converted", () => {
  assert.equal(
    canConvertLeadToProject({ stage: "WON", convertedProjectBoardId: null }),
    true
  );
});

test("canConvertLeadToProject rejects duplicate conversions", () => {
  assert.equal(
    canConvertLeadToProject({ stage: "WON", convertedProjectBoardId: "board-1" }),
    false
  );
});

test("convertLeadToProjectWithDependencies converts a won lead and links the new board", async () => {
  const createCompanyProjectBoardCalls: Array<Record<string, unknown>> = [];
  const updateManyCalls: Array<Record<string, unknown>> = [];
  const tx = {
    company: {
      findUnique: async () => ({ id: "company-1", ownerId: "user-1" }),
    },
    companyLead: {
      findFirst: async ({ select }: { select: Record<string, boolean> }) => {
        if ("title" in select) {
          return {
            id: "lead-1",
            title: "Website revamp",
            prospectName: "Acme Corp",
            notes: "",
            stage: "WON",
            convertedProjectBoardId: null,
          };
        }

        return {
          stage: "WON",
          convertedProjectBoardId: "board-1",
        };
      },
      updateMany: async (args: Record<string, unknown>) => {
        updateManyCalls.push(args);
        return { count: 1 };
      },
    },
  };

  const result = await convertLeadToProjectWithDependencies(
    {
      userId: "user-1",
      companyId: "company-1",
      leadId: "lead-1",
    },
    {
      prisma: {
        $transaction: createTransactionRunner(tx),
      },
      createCompanyProjectBoard: async (args) => {
        createCompanyProjectBoardCalls.push(args as Record<string, unknown>);
        return { id: "board-1" };
      },
    }
  );

  assert.deepEqual(result, {
    data: {
      boardId: "board-1",
      companyId: "company-1",
      leadId: "lead-1",
      workspaceType: "COMPANY",
    },
  });
  assert.equal(createCompanyProjectBoardCalls.length, 1);
  assert.match(String(createCompanyProjectBoardCalls[0]?.description), /Converted from won lead/);
  assert.equal(updateManyCalls.length, 1);
  assert.deepEqual(updateManyCalls[0], {
    where: {
      id: "lead-1",
      companyId: "company-1",
      stage: "WON",
      convertedProjectBoardId: null,
    },
    data: {
      convertedProjectBoardId: "board-1",
    },
  });
});

test("convertLeadToProjectWithDependencies returns already converted when the lead is already linked", async () => {
  const result = await convertLeadToProjectWithDependencies(
    {
      userId: "user-1",
      companyId: "company-1",
      leadId: "lead-1",
    },
    {
      prisma: {
        $transaction: createTransactionRunner({
          company: {
            findUnique: async () => ({ id: "company-1", ownerId: "user-1" }),
          },
          companyLead: {
            findFirst: async () => ({
              id: "lead-1",
              title: "Website revamp",
              prospectName: "Acme Corp",
              notes: "",
              stage: "WON",
              convertedProjectBoardId: "board-1",
            }),
          },
        }),
      },
      createCompanyProjectBoard: async () => {
        throw new Error("should not create board");
      },
    }
  );

  assert.deepEqual(result, { error: "ALREADY_CONVERTED" });
});

test("convertLeadToProjectWithDependencies returns invalid stage when the lead is no longer won at claim time", async () => {
  let findFirstCallCount = 0;

  const result = await convertLeadToProjectWithDependencies(
    {
      userId: "user-1",
      companyId: "company-1",
      leadId: "lead-1",
    },
    {
      prisma: {
        $transaction: createTransactionRunner({
          company: {
            findUnique: async () => ({ id: "company-1", ownerId: "user-1" }),
          },
          companyLead: {
            findFirst: async ({ select }: { select: Record<string, boolean> }) => {
              findFirstCallCount += 1;

              if ("title" in select) {
                return {
                  id: "lead-1",
                  title: "Website revamp",
                  prospectName: "Acme Corp",
                  notes: "",
                  stage: "WON",
                  convertedProjectBoardId: null,
                };
              }

              return {
                stage: "LOST",
                convertedProjectBoardId: null,
              };
            },
            updateMany: async () => ({ count: 0 }),
          },
        }),
      },
      createCompanyProjectBoard: async () => ({ id: "board-1" }),
    }
  );

  assert.deepEqual(result, { error: "INVALID_STAGE" });
  assert.equal(findFirstCallCount, 2);
});

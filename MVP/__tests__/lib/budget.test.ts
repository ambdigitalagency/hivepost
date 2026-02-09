import { checkBudgetForCandidates, getMonthlySpendUsd } from "@/lib/budget";

const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockGte = jest.fn();
const mockLte = jest.fn();

jest.mock("@/lib/supabase-server", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => {
      mockFrom(...args);
      return {
        select: (...args: unknown[]) => {
          mockSelect(...args);
          return {
            gte: (...args: unknown[]) => {
              mockGte(...args);
              return {
                lte: (...args: unknown[]) => {
                  mockLte(...args);
                  return Promise.resolve({ data: mockLedgerData, error: null });
                },
              };
            },
          };
        },
      };
    },
  },
}));

let mockLedgerData: { cost_usd_estimated: number }[] = [];

describe("budget", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLedgerData = [];
  });

  describe("getMonthlySpendUsd", () => {
    it("returns 0 when no ledger rows", async () => {
      mockLedgerData = [];
      expect(await getMonthlySpendUsd()).toBe(0);
      expect(mockFrom).toHaveBeenCalledWith("api_cost_ledger");
    });

    it("sums cost_usd_estimated for current month", async () => {
      mockLedgerData = [
        { cost_usd_estimated: 10 },
        { cost_usd_estimated: 20.5 },
      ];
      expect(await getMonthlySpendUsd()).toBe(30.5);
    });
  });

  describe("checkBudgetForCandidates", () => {
    it("allows candidates with candidateCount 30 when spend is 0", async () => {
      mockLedgerData = [];
      const result = await checkBudgetForCandidates();
      expect(result.allowed).toBe(true);
      expect(result.candidateCount).toBe(30);
      expect(result.spendUsd).toBe(0);
      expect(result.capUsd).toBe(100);
    });

    it("disallows when spend >= cap", async () => {
      mockLedgerData = [{ cost_usd_estimated: 100 }];
      const result = await checkBudgetForCandidates();
      expect(result.allowed).toBe(false);
      expect(result.candidateCount).toBe(0);
      expect(result.reason).toContain("budget");
    });

    it("reduces candidateCount to 10 when remaining < 5", async () => {
      mockLedgerData = [{ cost_usd_estimated: 96 }];
      const result = await checkBudgetForCandidates();
      expect(result.allowed).toBe(true);
      expect(result.candidateCount).toBe(10);
    });
  });
});

/**
 * 集成测试：candidates API 在「Post not found」时返回带 debug 的 404，
 * 用于验证参数与查询结果能被观测。
 * @jest-environment node
 */

import { NextRequest } from "next/server";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/db-user", () => ({
  getOrCreateUser: jest.fn(),
}));

const mockBusinessSingle = jest.fn();
const mockPostsSingle = jest.fn();
const mockPostsMaybeSingle = jest.fn();

jest.mock("@/lib/supabase-server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "businesses") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => mockBusinessSingle(),
              }),
            }),
          }),
        };
      }
      if (table === "posts") {
        return {
          select: (cols: string) => {
            if (cols === "id, business_id") {
              return { eq: () => ({ maybeSingle: () => mockPostsMaybeSingle() }) };
            }
            return {
              eq: () => ({
                eq: () => ({
                  single: () => mockPostsSingle(),
                }),
              }),
            };
          },
        };
      }
      return {};
    },
  },
}));

describe("POST /api/business/[id]/posts/[postId]/images/candidates", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { getServerSession } = require("next-auth");
    getServerSession.mockResolvedValue({ user: { id: "auth-u1" } });
    const { getOrCreateUser } = require("@/lib/db-user");
    getOrCreateUser.mockResolvedValue({ id: "app-u1" });
    mockBusinessSingle.mockResolvedValue({
      data: { id: "b1", category: null, name: "B", city: null, state: null, language: null },
      error: null,
    });
    mockPostsSingle.mockResolvedValue({ data: null, error: { code: "PGRST116", message: "not found" } });
    mockPostsMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it("returns 404 with debug when post not found for business", async () => {
    const { POST } = await import("@/app/api/business/[id]/posts/[postId]/images/candidates/route");
    const req = new NextRequest("http://localhost/api", { method: "POST", body: "{}" });
    const res = await POST(req, { params: Promise.resolve({ id: "b1", postId: "p1" }) });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Post not found");
    expect(body.debug).toBeDefined();
    expect(body.debug).toMatchObject({
      businessId: "b1",
      postId: "p1",
    });
    expect(typeof body.debug.postExistsWithOtherBusiness).toBe("boolean");
  });

  it("returns 404 with debug when businessId or postId missing", async () => {
    const { POST } = await import("@/app/api/business/[id]/posts/[postId]/images/candidates/route");
    const req = new NextRequest("http://localhost/api", { method: "POST", body: "{}" });
    const res = await POST(req, { params: Promise.resolve({ id: "b1", postId: "" }) });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Post not found");
    expect(body.debug).toMatchObject({
      receivedBusinessId: "b1",
      receivedPostId: "",
    });
  });
});

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateUser } from "@/lib/db-user";

/** 确保当前登录用户在 users 表存在，返回内部 user id。供前端/其他 API 使用。 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const user = await getOrCreateUser({
      id: session.user.id,
      email: session.user.email ?? undefined,
      name: session.user.name ?? undefined,
    });
    if (!user) return NextResponse.json({ error: "Failed to ensure user" }, { status: 500 });
    return NextResponse.json({ id: user.id });
  } catch (e) {
    console.error("users/ensure", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

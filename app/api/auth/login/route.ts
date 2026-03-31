import { NextRequest, NextResponse } from "next/server";

import { findStoredUserByEmail, sanitizeUser, readApiStore } from "@/app/lib/server/apiStore";
import { createAuthToken, verifyPassword } from "@/app/lib/server/authToken";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!email || !password) {
    return NextResponse.json(
      { error: "email and password are required" },
      { status: 400 }
    );
  }

  const store = await readApiStore();
  const user = findStoredUserByEmail(store, email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  const token = createAuthToken({ user_id: user.id });
  return NextResponse.json({
    token,
    user: sanitizeUser(user),
  });
}

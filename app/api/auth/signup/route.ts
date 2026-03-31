import { NextRequest, NextResponse } from "next/server";

import {
  findStoredUserByEmail,
  nextStoreId,
  sanitizeUser,
  updateApiStore,
} from "@/app/lib/server/apiStore";
import { createAuthToken, hashPassword } from "@/app/lib/server/authToken";

function isEmailValid(email: string) {
  return /\S+@\S+\.\S+/.test(email);
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  const firstName = String(body.first_name ?? "").trim();
  const lastName = String(body.last_name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = String(body.phone ?? "").trim();
  const password = String(body.password ?? "");

  if (!firstName || !lastName || !email || !password) {
    return NextResponse.json(
      { error: "first_name, last_name, email, and password are required" },
      { status: 400 }
    );
  }

  if (!isEmailValid(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  const result = await updateApiStore((store) => {
    if (findStoredUserByEmail(store, email)) {
      return { error: "An account already exists for that email." };
    }

    const user = {
      id: nextStoreId(store, "user"),
      first_name: firstName,
      last_name: lastName,
      email,
      phone: phone || undefined,
      password_hash: hashPassword(password),
      membership: "free" as const,
      subscription_status: "inactive" as const,
      saved_venue_ids: [] as number[],
      vendor_id: null,
      created_at: Date.now(),
    };

    store.users.push(user);
    const token = createAuthToken({ user_id: user.id });

    return {
      token,
      user: sanitizeUser(user),
    };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json(result);
}

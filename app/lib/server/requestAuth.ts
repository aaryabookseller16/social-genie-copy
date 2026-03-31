import { NextRequest, NextResponse } from "next/server";

import {
  readApiStore,
  sanitizeUser,
  type StoredUser,
} from "./apiStore";
import { verifyAuthToken } from "./authToken";

export type AuthenticatedRequest = {
  token: string;
  user: StoredUser;
};

export function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization")?.trim();
  if (!header?.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = header.slice(7).trim();
  return token || null;
}

export async function getAuthenticatedUser(
  request: NextRequest
): Promise<AuthenticatedRequest | null> {
  const token = getBearerToken(request);
  if (!token) {
    return null;
  }

  const payload = verifyAuthToken(token);
  if (!payload) {
    return null;
  }

  const store = await readApiStore();
  const user = store.users.find((entry) => entry.id === payload.user_id);
  if (!user) {
    return null;
  }

  return { token, user };
}

export async function requireAuthenticatedUser(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) {
    return {
      auth: null,
      errorResponse: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  return {
    auth,
    errorResponse: null,
  };
}

export function buildAuthResponse(user: StoredUser, token: string) {
  return NextResponse.json({
    token,
    user: sanitizeUser(user),
  });
}

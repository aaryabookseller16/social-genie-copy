import { NextRequest, NextResponse } from "next/server";

import { updateApiStore } from "@/app/lib/server/apiStore";
import { requireAuthenticatedUser } from "@/app/lib/server/requestAuth";

export async function POST(request: NextRequest) {
  const { auth, errorResponse } = await requireAuthenticatedUser(request);
  if (!auth) {
    return errorResponse;
  }

  const userFound = await updateApiStore((store) => {
    const user = store.users.find((entry) => entry.id === auth.user.id);
    if (!user) {
      return false;
    }

    user.membership = "vibee";
    user.subscription_status = "active";
    return true;
  });

  if (!userFound) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }

  const checkoutUrl = new URL("/", request.nextUrl.origin);
  checkoutUrl.searchParams.set("checkout", "success");

  return NextResponse.json({
    checkout_url: checkoutUrl.toString(),
  });
}

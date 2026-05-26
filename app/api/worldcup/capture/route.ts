import { NextRequest, NextResponse } from "next/server";
import { xanoFetch } from "@/app/lib/server/xanoProxy";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const result = await xanoFetch<{ success: boolean; message: string }>(
      "genie/ep_worldcup_capture_dev",
      {
        method: "POST",
        body: {
          email: body.email,
          first_name: body.first_name ?? "",
          city: body.city ?? "Houston",
          acquisition_source: body.acquisition_source ?? "worldcup_houston",
        },
      }
    );
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ success: false, error: "Could not save your info." }, { status: 200 });
  }
}
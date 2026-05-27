import { NextRequest, NextResponse } from "next/server";

const XANO_BASE = "https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e";

export async function GET(request: NextRequest) {
  try {
    const city = request.nextUrl.searchParams.get("city") ?? "Houston";
    const days_back = request.nextUrl.searchParams.get("days_back") ?? "30";
    const worldcup_only = request.nextUrl.searchParams.get("worldcup_only") ?? "false";

    const url = `${XANO_BASE}/admin/city-intelligence?city=${encodeURIComponent(city)}&days_back=${days_back}&worldcup_only=${worldcup_only}`;
    console.log("Fetching:", url);
    
    const res = await fetch(url, { cache: "no-store" });
   const text = await res.text();
console.log("Raw response:", text.substring(0, 500));
const data = JSON.parse(text);
    return NextResponse.json(data);
  } catch (error) {
    console.error("City intelligence error:", error);
    return NextResponse.json({ success: false, error: "Could not load city intelligence." });
  }
}
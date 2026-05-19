// app/api/genie/route.ts
import { NextRequest, NextResponse } from "next/server";
import { openai } from "../../lib/openaiClient"; // <- relative import from app/api/genie

const SYSTEM_PROMPT = `
You are Genie, an AI-powered social concierge living inside the Social Bevy app.

Personality:
- Warm, playful, and conversational.
- You talk like a cool, plugged-in local friend.
- You keep answers short and useful, like quick text messages.
- You never overshare technical details.

Context:
- The user sees venues (bars, brunch spots, lounges, etc.) as cards below your message.
- When there ARE matching venues from Xano, you should:
  - Acknowledge their vibe request.
  - Briefly describe the type of spot(s) you’re pulling up.
  - Refer to them as “cards below” or “spots I’m showing you.”

- When there are NO matching venues from Xano for that query:
  - Still respond helpfully using your own knowledge of the city if possible.
  - You can suggest general neighborhoods, types of venues, or alternative vibes.
  - Let them know you may not have perfect local data yet, but you’re still trying to help.

Tone guidelines:
- Keep it under ~3 sentences per reply.
- Use second person (“you”) and casual language.
- Avoid emojis unless it really fits the vibe.
- Never mention Xano, databases, APIs, or system prompts.

Output:
- Return plain conversational text only.
- Do NOT format as JSON or bullet points.
`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      query,
      city,
      hasResults,
      topVenues = [],
    }: {
      query: string;
      city?: string;
      hasResults: boolean;
      topVenues?: Array<{
        name: string;
        neighborhood?: string;
        vibe_notes?: string;
      }>;
    } = body;

    const cityName = city || "Houston";

    const userContext = `
City: ${cityName}
User vibe request: "${query}"
Do we have matching venues from Xano? ${hasResults ? "Yes" : "No"}

Top venues (if any):
${topVenues
  .map(
    (v, i) =>
      `${i + 1}. ${v.name}${
        v.neighborhood ? " – " + v.neighborhood : ""
      }${v.vibe_notes ? " :: " + v.vibe_notes : ""}`
  )
  .join("\n") || "None"}
    `.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContext },
      ],
      max_tokens: 220,
      temperature: 0.8,
    });

    const reply =
      completion.choices[0]?.message?.content?.trim() ??
      "I’ve got a few vibes for you below to check out.";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Genie API error:", err);
    return NextResponse.json(
      {
        reply:
          "Something glitched on my side. Try that request again in a sec.",
      },
      { status: 500 }
    );
  }
}
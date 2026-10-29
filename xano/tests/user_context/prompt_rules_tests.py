"""Saved-preference rules in the pick and converse prompts (review fix B, 2026-10-28).

fn_genie_build_prompt_dev adds section 7 (tiebreaker only, dislikes, wording, precedence) and
bumps the version to pick-v3.1 / converse-v1.1 only when the user has saved preferences. This
suite chats as test users through the Flutter chat endpoint (4369, debug on) and checks how the
model uses the preferences. Model-dependent cases run REPS times and must pass every time.

B0 (prompts without a context are unchanged) is checked separately with prompt_snapshot.py.

Profiles (tamu_capstone, "test-learn-" ids, verified, made by ep_test_fixture_dev):
  like  : likes Rooftop
  dis   : dislikes Loud & Lit (shown to the model as "not into: Loud & Lit")
Cases:
  B0b  chat with a context uses pick-v3.1 (and converse-v1.1 on follow-ups)
  B1   like Rooftop, "quiet coffee shop to work from": no rooftop venue forced in
  B2   dislike Loud & Lit, "bar for drinks tonight": Lost & Found (energetic, dancing) not picked
  B3   dislike Loud & Lit, asks for a loud dance club: energetic venues still picked
  B4   wording, over every reply and reason: no profile talk, no listing, no unprompted dislikes
  B5   follow-up "which of these is better for me?" after B2: picks a calm option
  B6   follow-up "does the first one have a patio?": no mention of preferences
  B7   dislike Loud & Lit, then in the same chat "actually somewhere loud and lively to dance":
       energetic venue picked (the conversation wins)
  B8   like Rooftop, Spanish request: Spanish reply, wording rules hold

Usage: python3 xano/tests/user_context/prompt_rules_tests.py [REPS]
"""
import json
import re
import sys
import time
import urllib.error
import urllib.request

ORIGIN = "https://xwpg-kuah-brlj.n7d.xano.io"
BRANCH = "flutter-v2-sandbox-tamu-capstone"
CHAT = f"{ORIGIN}/api:q_bU9d5K:{BRANCH}/genie/ep_genie_chat_v2_dev"
FIXTURE = f"{ORIGIN}/api:pgMKWi2e:{BRANCH}/genie/ep_test_fixture_dev"
HEADERS = {"Content-Type": "application/json", "X-Data-Source": "tamu_capstone"}
REPS = int(sys.argv[1]) if len(sys.argv) > 1 else 3
RUN = f"r{int(time.time())}"
LOST_AND_FOUND = 532

ENERGETIC = re.compile(r"energetic|danc|lively|high[- ]energy|loud|club|party|nightclub", re.I)
CALM = re.compile(r"relaxed|chill|calm|quiet|cozy|laid[- ]back|intimate|casual", re.I)
COFFEE = re.compile(r"coffee|caf[eé]|espresso|tea|bakery|roast", re.I)
ROOFTOP = re.compile(r"rooftop|roof top|skyline", re.I)
BANNED = re.compile(r"profile|saved preference|your preference|you prefer|you told me|you said you|not into|loud & lit|dislike|you avoid|avoiding|you don't like", re.I)

results = []
made = []


def post(url, body, timeout=400):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=HEADERS, method="POST")
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code < 500 or attempt == 2:
                return {"_http_error": e.code, "_body": e.read().decode()[:300]}
        except (TimeoutError, urllib.error.URLError):
            if attempt == 2:
                return {"_http_error": "timeout"}
        time.sleep(5)


def fixture(action, **kw):
    return post(FIXTURE, {"action": action, **kw})


def check(case, ok, detail):
    results.append((case, ok))
    print(("PASS" if ok else "FAIL"), case, "|", detail, flush=True)


def profile(name, ops):
    ext = f"test-learn-{RUN}-{name}"
    made.append(ext)
    fixture("create_user", external_user_id=ext, verified=True)
    fixture("seed_context", external_user_id=ext, ops=ops)
    return ext


def chat(ext, message, token=None, new=False, hint=None):
    body = {"message": message, "channel": "ios", "external_user_id": ext, "city_context": "Houston", "debug": True}
    if token:
        body["session_token"] = token
    if new:
        body["new_conversation"] = True
    if hint:
        body["turn_hint"] = hint
    return post(CHAT, body)


def picks(r):
    """[(venue_id, name, vibe_notes)] of the picks, best first."""
    shown = {v.get("id"): v for v in (r.get("turn_venues") or []) + (r.get("venues") or [])}
    out = []
    for p in r.get("pick_reasons") or []:
        vid = p.get("venue_id")
        v = shown.get(vid) or {}
        out.append((vid, p.get("venue_name") or v.get("venue_name"), (v.get("vibe_notes") or "") + " " + str(v.get("venue_name") or "")))
    return out


def texts(r):
    return [r.get("reply") or ""] + [p.get("reason") or "" for p in (r.get("pick_reasons") or [])]


def version(r):
    return ((r.get("llm") or {}).get("prompt_version"))


def wording_ok(r, allow_loud=False):
    bad = []
    for t in texts(r):
        for m in BANNED.finditer(t):
            word = m.group(0).lower()
            if allow_loud and word == "loud & lit":
                continue
            bad.append(word)
    return not bad, bad


def main():
    print("run", RUN, "reps", REPS, flush=True)
    like = profile("like", [{"op": "add", "category": "atmosphere", "value": "Rooftop", "source": "stated", "confidence": 1}])
    dis = profile("dis", [{"op": "add", "category": "atmosphere", "value": "Loud & Lit", "source": "stated", "confidence": 1, "sentiment": "dislike"}])

    for rep in range(1, REPS + 1):
        # B1: a like never forces a venue that doesn't fit the request.
        r = chat(like, "quiet coffee shop to work from in Houston", new=True)
        p = picks(r)
        forced = [n for _, n, txt in p if ROOFTOP.search(txt) and not COFFEE.search(txt)]
        check(f"B1 tiebreaker only (rep {rep})", bool(p) and not forced and version(r) == "pick-v3.1",
              f"version={version(r)} picks={[n for _, n, _ in p]} forced={forced}")
        ok, bad = wording_ok(r)
        check(f"B4 wording on B1 (rep {rep})", ok, f"banned={bad}")

        # B2: a dislike keeps a clearly matching venue out.
        r2 = chat(dis, "bar for drinks tonight in Houston", new=True)
        p2 = picks(r2)
        ids = [vid for vid, _, _ in p2]
        check(f"B2 dislike keeps Lost & Found out (rep {rep})", bool(p2) and LOST_AND_FOUND not in ids and version(r2) == "pick-v3.1",
              f"version={version(r2)} picks={[n for _, n, _ in p2]}")
        ok, bad = wording_ok(r2)
        check(f"B4 wording on B2 (rep {rep})", ok, f"banned={bad} reply={(r2.get('reply') or '')[:120]!r}")

        # B5: comparison follow-up uses the dislike to choose.
        token = r2.get("session_token")
        r5 = chat(dis, "which of these is better for me?", token=token)
        p5 = picks(r5)
        first = p5[0] if p5 else None
        calm_first = bool(first) and not (ENERGETIC.search(first[2]) and not CALM.search(first[2]))
        ok, bad = wording_ok(r5)
        check(f"B5 comparison follow-up (rep {rep})", r5.get("turn_kind") == "followup" and version(r5) == "converse-v1.1" and calm_first and ok,
              f"turn_kind={r5.get('turn_kind')} version={version(r5)} first={first[1] if first else None} banned={bad} reply={(r5.get('reply') or '')[:140]!r}")

        # B6: neutral follow-up doesn't bring preferences up.
        r6 = chat(dis, "does the first one have a patio?", token=token)
        ok, bad = wording_ok(r6)
        taste = re.findall(r"your taste|you like|you prefer|you love", r6.get("reply") or "", re.I)
        check(f"B6 neutral follow-up (rep {rep})", r6.get("turn_kind") == "followup" and ok and not taste,
              f"version={version(r6)} banned={bad} taste={taste} reply={(r6.get('reply') or '')[:140]!r}")

        # B3: the request wins over a dislike.
        r3 = chat(dis, "a loud dance club with a high-energy crowd in Houston", new=True)
        p3 = picks(r3)
        energetic = [n for _, n, txt in p3 if ENERGETIC.search(txt)]
        ok, bad = wording_ok(r3, allow_loud=True)
        bad = [b for b in bad if b not in ("loud & lit",)]
        check(f"B3 asked-for loud still picked (rep {rep})", bool(energetic) and not bad,
              f"picks={[n for _, n, _ in p3]} energetic={energetic} banned={bad}")

        # B7: what the user says in this conversation overrides the saved dislike.
        r7a = chat(dis, "bar for drinks tonight in Houston", new=True)
        r7 = chat(dis, "actually tonight I want somewhere loud and lively to dance", token=r7a.get("session_token"), hint="request")
        p7 = picks(r7)
        energetic7 = [n for _, n, txt in p7 if ENERGETIC.search(txt)]
        check(f"B7 conversation overrides the dislike (rep {rep})", r7.get("turn_kind") == "request" and bool(energetic7),
              f"turn_kind={r7.get('turn_kind')} picks={[n for _, n, _ in p7]} energetic={energetic7}")

        # B8: Spanish request with a saved like.
        r8 = chat(like, "busco un bar tranquilo para tomar algo en Houston", new=True)
        reply = r8.get("reply") or ""
        es = len(re.findall(r"\b(un|una|para|con|aquí|tres|lugares|tranquilo|ambiente|perfecto|ideal|bar|esta|noche)\b", reply, re.I))
        en = len(re.findall(r"\b(the|and|with|here|are|for|great|spot|spots|perfect)\b", reply, re.I))
        ok, bad = wording_ok(r8)
        check(f"B8 Spanish reply, wording holds (rep {rep})", es > en and ok and version(r8) == "pick-v3.1",
              f"version={version(r8)} es={es} en={en} banned={bad} reply={reply[:120]!r}")


if __name__ == "__main__":
    try:
        main()
    finally:
        print("cleanup", fixture("cleanup", external_user_ids=made), flush=True)
        passed = sum(1 for _, ok in results if ok)
        print(f"\n{passed}/{len(results)} passed (run {RUN})")
        sys.exit(0 if results and passed == len(results) else 1)

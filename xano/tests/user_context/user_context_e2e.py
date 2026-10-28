"""User context end to end: every endpoint that reads or writes it, on a fresh guest device.

Steps (each write is followed by reading the context back and checking it):
  1. get_user_context       -> nothing saved yet (then init_device, as the app does on load)
  2. save_quick_picks       -> Rooftop, Brunch saved as stated likes
  3. learn_from_message     -> a dislike and a like learned from a chat message
  4. track_signal venue_save -> the venue's cuisine and price saved as inferred (0.4)
  5. update_social_profile  -> profile fields mirrored into the context
  6. chat turn (guest)      -> the turn reads the device context (likes, avoid list)
  7. merge_guest_profile    -> sign-in: the device context is linked to the account
  8. chat turn (signed in)  -> the turn reads the account context
Then the Flutter group (genie_v15) on a second device: learn, chat, quick picks and the read
endpoint (4605/4606). Last, save_venue as the test user on both groups: a new save adds the
venue's cuisine and price as inferred entries; the test unsaves it again afterwards.
ep_save_social_preferences_dev needs a genie_user auth token (magic-link sign-in), so it is
not covered here.

Chat calls send debug: true, because the genie_v15 endpoint hides the context/search keys
without it (conversation v1, 2026-10-24).

Usage: python3 xano/tests/user_context/user_context_e2e.py
Env: XANO_DATA_SOURCE (default tamu_capstone), TEST_USER_EXTERNAL_ID and TEST_USER_ID (default:
capstone test user 63).
Writes go to test rows in the tamu_capstone datasource only.
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

ORIGIN = "https://xwpg-kuah-brlj.n7d.xano.io"
BRANCH = "flutter-v2-sandbox-tamu-capstone"
GENIE_DEV = f"{ORIGIN}/api:pgMKWi2e:{BRANCH}"   # the web app's group
GENIE_V15 = f"{ORIGIN}/api:q_bU9d5K:{BRANCH}"   # the Flutter app's group
DATA_SOURCE = os.environ.get("XANO_DATA_SOURCE", "tamu_capstone")
TEST_USER = os.environ.get("TEST_USER_EXTERNAL_ID", "a8c0b52f-06df-4e0c-8636-220ee55c61b4")
TEST_USER_ID = int(os.environ.get("TEST_USER_ID", "63"))  # genie_user id of TEST_USER
HEADERS = {"Content-Type": "application/json", "X-Data-Source": DATA_SOURCE}

results = []


def call(base, path, body=None, params=None):
    url = f"{base}/{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=HEADERS, method="POST" if body is not None else "GET")
    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=400) as r:
            return json.loads(r.read() or b"null"), time.time() - start
    except urllib.error.HTTPError as e:
        return {"_http_error": e.code, "_body": e.read().decode()[:300]}, time.time() - start


def prefs(device=None, external=None):
    params = {"device_id": device} if device else {"external_user_id": external}
    d, _ = call(GENIE_DEV, "genie/ep_get_user_context_dev", params=params)
    ctx = (d or {}).get("context") or {}
    live = [p for p in (ctx.get("preferences") or []) if p.get("status") in ("active", "user_edited")]
    return d, {p["id"]: p for p in live}


def check(step, ok, detail):
    results.append((step, ok))
    print(("PASS" if ok else "FAIL"), step, "|", detail)


def has(pmap, cat, value_part, sentiment="like", source=None):
    for p in pmap.values():
        if p.get("category") == cat and value_part.lower() in str(p.get("value", "")).lower():
            if p.get("sentiment", "like") == sentiment and (source is None or p.get("source") == source):
                return True
    return False


def main():
    device = f"e2e-ctx-{int(time.time())}"
    print("device", device, "| test user", TEST_USER, "| data source", DATA_SOURCE)

    d, p = prefs(device=device)
    check("1 get (empty)", d.get("found") is False and not p, f"found={d.get('found')}")

    # The app calls init_device on page load; it creates the guest's social profile row.
    r, t = call(GENIE_DEV, "genie/init_device", {"device_id": device, "external_user_id": "web_guest"})
    check("1b init_device", isinstance(r, dict) and "_http_error" not in r, f"{t:.1f}s")

    r, t = call(GENIE_DEV, "genie/ep_save_quick_picks_dev", {
        "device_id": device, "status": "completed", "card_ids": ["rooftop_happy_hour"],
        "picks": [{"category": "atmosphere", "value": "Rooftop"}, {"category": "experience", "value": "Brunch"}]})
    _, p = prefs(device=device)
    check("2 quick picks", has(p, "atmosphere", "rooftop", source="stated") and has(p, "experience", "brunch", source="stated"),
          f"{t:.1f}s, {sorted(p)}")

    r, t = call(GENIE_DEV, "genie/ep_learn_from_message_dev", {
        "message": "honestly I can't stand happy hours, but I love live jazz", "external_user_id": "web_guest", "device_id": device})
    _, p = prefs(device=device)
    check("3 learn from chat", has(p, "experience", "happy hour", "dislike") and any("jazz" in k or "live" in k for k in p),
          f"{t:.1f}s, saved={[(s.get('value'), s.get('sentiment')) for s in (r or {}).get('saved', [])]}")

    r, t = call(GENIE_DEV, "genie/track_signal", {
        "device_id": device, "external_user_id": "web_guest", "signal_type": "venue_save", "signal_value": "1108"})
    _, p = prefs(device=device)
    inferred = [(x["category"], x["value"], x.get("confidence")) for x in p.values() if x.get("source") == "inferred" and x["category"] in ("food", "price")]
    check("4 venue save", len(inferred) > 0 and all(abs((c or 0) - 0.4) < 1e-6 for _, _, c in inferred),
          f"{t:.1f}s, inferred={inferred}, sync={(r or {}).get('context_sync')}")

    r, t = call(GENIE_DEV, "genie/update_social_profile", {
        "device_id": device, "external_user_id": "web_guest", "group_size": "small_group", "typical_time": "late_night"})
    _, p = prefs(device=device)
    check("5 profile edit", has(p, "group_size", "small", source="stated") and has(p, "typical_time", "late", source="stated"),
          f"{t:.1f}s, sync={(r or {}).get('context_sync')}")

    r, t = call(GENIE_DEV, "genie/ep_genie_chat_v2_dev", {
        "message": "somewhere for drinks in Houston", "channel": "web", "external_user_id": "web_guest",
        "device_id": device, "city_context": "Houston", "debug": True})
    c = (r or {}).get("context") or {}
    check("6 chat reads guest context", c.get("source") == "device" and (c.get("count") or 0) > 0 and "happy hour" in (c.get("avoid") or []),
          f"{t:.1f}s, context={c}")

    _, before = prefs(external=TEST_USER)
    r, t = call(GENIE_DEV, "genie/merge_guest_profile", {"device_id": device, "external_user_id": TEST_USER})
    _, after = prefs(external=TEST_USER)
    check("7 sign-in links context", has(after, "atmosphere", "rooftop") and has(after, "experience", "happy hour", "dislike"),
          f"{t:.1f}s, link={(r or {}).get('context_link')}, account prefs {len(before)} -> {len(after)}")

    r, t = call(GENIE_DEV, "genie/ep_genie_chat_v2_dev", {
        "message": "somewhere for drinks in Houston", "channel": "web", "external_user_id": TEST_USER,
        "device_id": device, "city_context": "Houston", "debug": True})
    c = (r or {}).get("context") or {}
    check("8 chat reads account context", c.get("source") == "user" and (c.get("count") or 0) > 0, f"{t:.1f}s, context={c}")

    # Flutter group (genie_v15): learn + chat on a second guest device.
    device2 = device + "-flutter"
    call(GENIE_V15, "genie/init_device", {"device_id": device2, "external_user_id": "web_guest"})
    r, t = call(GENIE_V15, "genie/ep_learn_from_message_dev", {
        "message": "I'm really into speakeasies", "external_user_id": "web_guest", "device_id": device2})
    _, p = prefs(device=device2)
    check("9 genie_v15 learn", any("speakeasy" in k for k in p), f"{t:.1f}s, {sorted(p)}")
    r, t = call(GENIE_V15, "genie/ep_genie_chat_v2_dev", {
        "message": "a bar for drinks in Houston", "channel": "app", "external_user_id": "web_guest",
        "device_id": device2, "city_context": "Houston", "debug": True})
    c = (r or {}).get("context") or {}
    check("10 genie_v15 chat reads context", c.get("source") == "device" and (c.get("count") or 0) > 0, f"{t:.1f}s, context={c}")

    r, t = call(GENIE_V15, "genie/ep_save_quick_picks_dev", {
        "device_id": device2, "status": "completed", "card_ids": [],
        "picks": [{"category": "atmosphere", "value": "Lounge"}]})
    d, _ = call(GENIE_V15, "genie/ep_get_user_context_dev", params={"device_id": device2})
    live = [p for p in ((d or {}).get("context") or {}).get("preferences") or [] if p.get("status") in ("active", "user_edited")]
    check("11 genie_v15 quick picks + read", any(p["category"] == "atmosphere" and p["value"].lower() == "lounge" for p in live),
          f"{t:.1f}s, {[(p['category'], p['value']) for p in live]}")

    # save_venue identifies people by genie_user id; the test user is genie_user 63.
    for step, base in (("12 save_venue genie_v15", GENIE_V15), ("13 save_venue Genie_Dev", GENIE_DEV)):
        _, before = prefs(external=TEST_USER)
        r, t = call(base, "genie/save_venue", {"venue_id": 1108, "user_id": TEST_USER_ID, "source_screen": "e2e"})
        _, after = prefs(external=TEST_USER)
        sync = (r or {}).get("context_sync") or {}
        inferred = [(x["category"], x["value"]) for x in after.values() if x.get("source") == "inferred" and x["category"] in ("food", "price")]
        check(step, sync.get("owner") == "user" and (sync.get("applied") or 0) > 0 and inferred,
              f"{t:.1f}s, sync={sync}, inferred={inferred}")
        # Clean up: the genie_v15 copy toggles, so a second call unsaves.
        call(GENIE_V15, "genie/save_venue", {"venue_id": 1108, "user_id": TEST_USER_ID})

    passed = sum(1 for _, ok in results if ok)
    print(f"\n{passed}/{len(results)} passed")
    sys.exit(0 if passed == len(results) else 1)


if __name__ == "__main__":
    main()

"""Checks that the two chat endpoint copies stay the same (review fix A, 2026-10-28).

genie/ep_genie_chat_v2_dev exists twice: 4369 (genie_v15, the Flutter app) and 4200 (Genie_Dev,
the web app). 4200 is a copy of 4369 except api_group. This script:
  1. compares the two snapshots in xano/flutter-v2-sandbox-tamu-capstone/apis (comments and
     the api_group line removed): they must be identical;
  2. sends the same turns to both endpoints and compares the response keys and turn kinds:
     a request, a follow-up with the returned token, new_conversation = true with an old token,
     and turn_hint = request on a follow-up-looking message; with and without debug;
  3. checks the error path: a missing external_user_id and a bad radius_meters return a JSON
     input error (not a PHP fatal) on both.
Model replies differ run to run, so only keys and turn kinds are compared, not text.

Usage: python3 xano/tests/chat/endpoint_parity.py   (tamu_capstone; uses the web_guest id)
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SNAP = os.path.join(ROOT, "flutter-v2-sandbox-tamu-capstone", "apis")
ORIGIN = "https://xwpg-kuah-brlj.n7d.xano.io"
BRANCH = "flutter-v2-sandbox-tamu-capstone"
ENDPOINTS = {
    "4200": f"{ORIGIN}/api:pgMKWi2e:{BRANCH}/genie/ep_genie_chat_v2_dev",
    "4369": f"{ORIGIN}/api:q_bU9d5K:{BRANCH}/genie/ep_genie_chat_v2_dev",
}
HEADERS = {"Content-Type": "application/json", "X-Data-Source": "tamu_capstone"}
results = []


def check(case, ok, detail):
    results.append((case, ok))
    print(("PASS" if ok else "FAIL"), case, "|", detail, flush=True)


def code_only(path):
    lines = []
    for line in open(path).read().splitlines():
        stripped = line.strip()
        if stripped.startswith("//") or stripped.startswith("api_group") or not stripped:
            continue
        lines.append(line.rstrip())
    return "\n".join(lines)


def post(url, body):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=HEADERS, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def turns(url, debug):
    base = {"channel": "web", "external_user_id": "web_guest", "city_context": "Houston", "debug": debug}
    out = []
    s, b = post(url, {**base, "message": "rooftop bar in Houston", "new_conversation": True})
    r1 = json.loads(b)
    out.append(("request", s, r1))
    s, b = post(url, {**base, "message": "which of these has a patio?", "session_token": r1.get("session_token")})
    out.append(("followup", s, json.loads(b)))
    s, b = post(url, {**base, "message": "a quiet wine bar", "session_token": r1.get("session_token"), "new_conversation": True})
    r3 = json.loads(b)
    out.append(("new_conversation", s, r3))
    r3["_old_token"] = r1.get("session_token")
    s, b = post(url, {**base, "message": "what about the second one?", "session_token": r3.get("session_token"), "turn_hint": "request"})
    out.append(("turn_hint_request", s, json.loads(b)))
    return out


def main():
    a = code_only(os.path.join(SNAP, "ep_genie_chat_v2_dev.xs"))
    b = code_only(os.path.join(SNAP, "genie_v15", "ep_genie_chat_v2_dev.xs"))
    check("A1 snapshots identical (code)", a == b, f"{len(a)} vs {len(b)} chars")

    for debug in (False, True):
        runs = {name: turns(url, debug) for name, url in ENDPOINTS.items()}
        for (label, s1, r1), (_, s2, r2) in zip(runs["4200"], runs["4369"]):
            k1, k2 = set(r1) - {"_old_token"}, set(r2) - {"_old_token"}
            same_keys = k1 == k2
            same_kind = r1.get("turn_kind") == r2.get("turn_kind")
            check(f"A1 {label} debug={debug}: same keys and turn kind", s1 == 200 and s2 == 200 and same_keys and same_kind,
                  f"status {s1}/{s2} turn_kind {r1.get('turn_kind')}/{r2.get('turn_kind')} only4200={sorted(k1 - k2)} only4369={sorted(k2 - k1)}")
        expect = {"request": "request", "followup": "followup", "new_conversation": "request", "turn_hint_request": "request"}
        for label, s, r in runs["4200"]:
            ok = r.get("turn_kind") == expect[label]
            if label == "new_conversation":
                ok = ok and r.get("session_token") != r.get("_old_token") and r.get("turn_index") == 1
            if label == "followup":
                ok = ok and r.get("refers_to_request_index") == 1
            check(f"A1 4200 {label} debug={debug} behaves", ok,
                  f"turn_kind={r.get('turn_kind')} turn_index={r.get('turn_index')} refers={r.get('refers_to_request_index')}")
        hidden = {"llm", "context", "search", "timings"}
        r = runs["4200"][0][2]
        if debug:
            check("A1 4200 debug=True has diagnostics", hidden <= set(r), f"keys present={sorted(hidden & set(r))}")
        else:
            check("A1 4200 debug=False hides diagnostics", not (hidden & set(r)), f"leaked={sorted(hidden & set(r))}")

    for name, url in ENDPOINTS.items():
        s, body = post(url, {"message": "hi", "channel": "web"})
        is_json = True
        try:
            parsed = json.loads(body)
        except json.JSONDecodeError:
            is_json, parsed = False, body
        check(f"A2 {name} missing external_user_id: JSON input error", s == 400 and is_json and not re.search(r"fatal|stack", body, re.I),
              f"status={s} body={str(parsed)[:120]}")
        s, body = post(url, {"message": "hi", "channel": "web", "external_user_id": "web_guest", "radius_meters": "far"})
        try:
            json.loads(body)
            is_json = True
        except json.JSONDecodeError:
            is_json = False
        check(f"A2 {name} bad radius_meters: JSON input error", s == 400 and is_json and not re.search(r"fatal", body, re.I),
              f"status={s} body={body[:120]}")


if __name__ == "__main__":
    main()
    passed = sum(1 for _, ok in results if ok)
    print(f"\n{passed}/{len(results)} passed")
    sys.exit(0 if passed == len(results) else 1)

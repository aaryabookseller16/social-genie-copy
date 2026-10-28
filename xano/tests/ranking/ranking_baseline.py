"""GEN-071 ranking baseline.

Sends each request in ranking_baseline.json to the capstone chat endpoint and checks the
shortlist (search.ranking, the venues the model chooses from) against GEN-071's acceptance
criteria:
  - an English request and its Spanish equivalent get the same mode and share >= 70% of the
    shorter top-10 list
  - expect_top5 venues are in the top 5
  - no venue whose name looks like lodging or a non-hospitality business
  - every ranked venue has a score breakdown that adds up to its score
  - a city that is not supported does not run the search

Usage: python3 xano/tests/ranking/ranking_baseline.py
Env: GENIE_CHAT_URL (default: capstone genie_v15 ep_genie_chat_v2_dev), XANO_DATA_SOURCE
(default tamu_capstone). Requests run one at a time so the latency figures are real.
"""
import json
import os
import pathlib
import sys
import time
import urllib.request

URL = os.environ.get(
    "GENIE_CHAT_URL",
    "https://xwpg-kuah-brlj.n7d.xano.io/api:q_bU9d5K:flutter-v2-sandbox-tamu-capstone/genie/ep_genie_chat_v2_dev",
)
DATA_SOURCE = os.environ.get("XANO_DATA_SOURCE", "tamu_capstone")
SPEC = json.loads((pathlib.Path(__file__).parent / "ranking_baseline.json").read_text())


def chat(message, location=None):
    body = {"message": message, "channel": "web", "external_user_id": "web_guest", "city_context": "Houston"}
    if location:
        body.update({"lat": location["lat"], "lng": location["lng"], "radius_meters": location["radius_meters"]})
    req = urllib.request.Request(
        URL,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "X-Data-Source": DATA_SOURCE},
    )
    start = time.time()
    with urllib.request.urlopen(req, timeout=120) as r:
        data = json.loads(r.read())
    return data, time.time() - start


def shortlist(d):
    s = d.get("search") or {}
    return [r.get("id") for r in (s.get("ranking") or [])]


def check_common(d, label, problems):
    s = d.get("search") or {}
    for r in s.get("ranking") or []:
        parts = r.get("breakdown") or {}
        if not parts:
            problems.append("%s: venue %s has no breakdown" % (label, r.get("id")))
        elif abs(sum(parts.values()) - (r.get("score") or 0)) > 0.05:
            problems.append("%s: venue %s breakdown does not add up" % (label, r.get("id")))
    names = [((v.get("venue_name") or "").lower()) for v in (d.get("venues") or [])]
    for n in names:
        for bad in SPEC["bad_name_patterns"]:
            if bad in n:
                problems.append("%s: bad venue %r" % (label, n))


def main():
    problems = []
    latencies = []
    print("%-16s %-6s %-6s %-8s %-5s %s" % ("case", "mode", "mode", "overlap", "src", "top 5 (en)"))
    for p in SPEC["pairs"]:
        loc = SPEC.get(p.get("location")) if p.get("location") else None
        en, t1 = chat(p["en"], loc)
        es, t2 = chat(p["es"], loc)
        latencies += [t1, t2]
        m_en, m_es = en.get("query_mode"), es.get("query_mode")
        ids_en, ids_es = shortlist(en), shortlist(es)
        overlap = len(set(ids_en[:10]) & set(ids_es[:10]))
        denom = min(len(ids_en[:10]), len(ids_es[:10]))
        src = (en.get("search") or {}).get("source") or "-"
        print("%-16s %-6s %-6s %-8s %-5s %s" % (p["id"], m_en, m_es, "%d/%d" % (overlap, denom) if denom else "-", src, ids_en[:5]))
        if m_en != p["mode"] or m_es != p["mode"]:
            problems.append("%s: mode en=%s es=%s, want %s" % (p["id"], m_en, m_es, p["mode"]))
        if p["mode"] == "venue":
            if not ids_en or not ids_es:
                problems.append("%s: empty shortlist (en %d, es %d)" % (p["id"], len(ids_en), len(ids_es)))
            elif overlap < 0.7 * denom:
                problems.append("%s: EN/ES share only %d of %d" % (p["id"], overlap, denom))
        for vid in p.get("expect_top5", []):
            for lang, ids in (("en", ids_en), ("es", ids_es)):
                if vid not in ids[:5]:
                    problems.append("%s (%s): venue %s not in top 5 %s" % (p["id"], lang, vid, ids[:5]))
        check_common(en, p["id"] + " en", problems)
        check_common(es, p["id"] + " es", problems)

    for s in SPEC["singles"]:
        d, t = chat(s["message"])
        latencies.append(t)
        city = ((d.get("search") or {}).get("city")) or {}
        print("%-16s %-6s %-6s %-8s %-5s %s  city=%s" % (s["id"], d.get("query_mode"), "", "", (d.get("search") or {}).get("source") or "-", shortlist(d)[:5], city))
        if d.get("query_mode") != s["mode"]:
            problems.append("%s: mode %s, want %s" % (s["id"], d.get("query_mode"), s["mode"]))
        if s.get("expect_city_supported") is False:
            if city.get("supported") is not False or (d.get("search") or {}).get("used"):
                problems.append("%s: unsupported city still searched (city=%s)" % (s["id"], city))
        check_common(d, s["id"], problems)

    latencies.sort()
    print("\nlatency per turn: median %.1fs, p90 %.1fs, max %.1fs (%d turns)" % (
        latencies[len(latencies) // 2], latencies[int(len(latencies) * 0.9)], latencies[-1], len(latencies)))
    print("\n%d problem(s)" % len(problems))
    for pr in problems:
        print("  -", pr)
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()

"""Find venues mentioning a term, to hand-label good answers. Usage: lookup.py term [term...]"""
import json, os, re, sys

here = os.path.dirname(os.path.abspath(__file__))
rows = json.load(open(os.path.join(here, "venues.json"), encoding="utf-8"))
pool = [r for r in rows if r.get("city_id") == 1 and r.get("status") == "active"
        and r.get("google_business_status") not in ("CLOSED_PERMANENTLY", "CLOSED_TEMPORARILY")]

def strong(r):
    return " ".join(str(r.get(k) or "") for k in ["venue_name", "vibe_notes", "crowd", "music", "best_time_to_go"]).lower() \
        + " " + " ".join(r.get("cuisine_tags") or []) + " patio:" + str(r.get("patio")) + " hookah:" + str(r.get("hookah"))

def reviews(r):
    v = r.get("review_highlights_json")
    return [x.get("text") or "" for x in v if isinstance(x, dict) and (x.get("rating") or 0) >= 4] if isinstance(v, list) else []

for term in sys.argv[1:]:
    pat = re.compile(term, re.I)
    print(f"\n######## {term}")
    hits = []
    for r in pool:
        s = bool(pat.search(strong(r)))
        rv = [t for t in reviews(r) if pat.search(t)]
        if s or rv:
            hits.append((s, len(rv), r))
    hits.sort(key=lambda h: (-h[0], -h[1], -(h[2].get("google_rating") or 0)))
    for s, n, r in hits[:25]:
        print(f"  {r['id']:5d} {'S' if s else ' '} rev{n} {r.get('google_rating')}/{r.get('google_user_ratings_total')} "
              f"{r['venue_name'][:38]:38s} | {(r.get('area_neighborhood') or r.get('neighborhood_text') or '')[:22]:22s} | "
              f"{r.get('price_band')} | {','.join(t for t in (r.get('google_types') or []) if t in ('bar','restaurant','night_club','cafe'))} | "
              f"{(r.get('vibe_notes') or '')[:70]}")

import json, sys, time, urllib.request, concurrent.futures as cf
URL = "https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e:flutter-v2-sandbox-tamu-capstone/genie/tmp_extract_search_filters_dev"

# (message, expected subset). For keywords, each expected entry is "a|b" = any of these must appear
# in at least one keyword. "absent" lists fields that must be empty.
CASES = [
 ("find me a bar for drinks tonight in Houston", {"mode": "venue", "venue_type": "bar", "city": "Houston"}),
 ("encuéntrame un bar para tomar algo esta noche en Houston", {"mode": "venue", "venue_type": "bar", "city": "Houston", "language": "es"}),
 ("rooftop bar in Midtown", {"mode": "venue", "venue_type": "bar", "neighborhood": "Midtown", "keywords": ["rooftop"]}),
 ("un bar en una azotea en Midtown", {"mode": "venue", "venue_type": "bar", "neighborhood": "Midtown", "keywords": ["rooftop"]}),
 ("what events are happening this weekend", {"mode": "event"}),
 ("eventos este fin de semana", {"mode": "event"}),
 ("conciertos esta noche", {"mode": "event"}),
 ("any comedy shows friday?", {"mode": "event"}),
 ("una cita romántica con sushi", {"mode": "venue", "cuisine": "sushi", "keywords": ["romantic|date"]}),
 ("romantic sushi date", {"mode": "venue", "cuisine": "sushi", "keywords": ["romantic|date"]}),
 ("Montrose cocktails", {"mode": "venue", "neighborhood": "Montrose", "keywords": ["cocktail"]}),
 ("cocteles en Montrose", {"mode": "venue", "neighborhood": "Montrose", "keywords": ["cocktail"]}),
 ("surprise me", {"mode": "ambient"}),
 ("estoy aburrido, qué hago?", {"mode": "ambient"}),
 ("brunch spot with bottomless mimosas", {"mode": "venue", "meal_service": "brunch", "keywords": ["mimosa"]}),
 ("brunch con mimosas ilimitadas", {"mode": "venue", "meal_service": "brunch", "keywords": ["mimosa"]}),
 ("cheap tacos open right now", {"mode": "venue", "cuisine": "tacos|mexican|tex-mex", "open_now": True, "price_band": "$"}),
 ("tacos baratos abiertos ahora mismo", {"mode": "venue", "cuisine": "tacos|mexican|tex-mex", "open_now": True, "price_band": "$"}),
 ("sports bar to watch the game", {"mode": "venue", "venue_type": "bar", "keywords": ["sports"]}),
 ("un bar deportivo para ver el partido", {"mode": "venue", "venue_type": "bar", "keywords": ["sports"]}),
 ("chill lounge with hookah", {"mode": "venue", "energy": "Chill", "keywords": ["hookah"]}),
 ("un lounge tranquilo con hookah", {"mode": "venue", "energy": "Chill", "keywords": ["hookah"]}),
 ("fancy steakhouse for a birthday dinner", {"mode": "venue", "cuisine": "steakhouse", "price_band": "$$$$"}),
 ("un steakhouse elegante para una cena de cumpleaños", {"mode": "venue", "cuisine": "steakhouse", "price_band": "$$$$"}),
 ("where can I dance tonight", {"mode": "venue", "keywords": ["danc"]}),
 ("dónde puedo bailar esta noche", {"mode": "venue", "keywords": ["danc"]}),
 ("live jazz bar", {"mode": "venue", "venue_type": "bar", "keywords": ["jazz"]}),
 ("late night food in EaDo", {"mode": "venue", "meal_service": "late_night", "neighborhood": "EaDo"}),
 ("coffee shop to work from", {"mode": "venue", "venue_type": "cafe"}),
 ("seafood in Dallas", {"mode": "venue", "cuisine": "seafood", "city": "Dallas"}),
]

def call(msg):
    body = json.dumps({"message": msg, "city_context": "Houston"}).encode()
    req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json", "X-Data-Source": "tamu_capstone"})
    t = time.time()
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read()), time.time() - t

def check(got, exp):
    errs = []
    if not got.get("ok"):
        return ["not ok: %s" % got.get("fail_reason")]
    for k, v in exp.items():
        g = got.get(k)
        if k == "keywords":
            kws = " | ".join(got.get("keywords") or []).lower()
            for alt in v:
                if not any(a in kws for a in alt.split("|")):
                    errs.append("keywords lack %s (%s)" % (alt, kws))
        elif isinstance(v, str) and "|" in v:
            if not any(a == (g or "").lower() for a in v.split("|")):
                errs.append("%s=%r want %s" % (k, g, v))
        elif isinstance(v, str):
            if (g or "").lower() != v.lower():
                errs.append("%s=%r want %r" % (k, g, v))
        elif g != v:
            errs.append("%s=%r want %r" % (k, g, v))
    return errs

with cf.ThreadPoolExecutor(6) as ex:
    results = list(ex.map(lambda c: (c, call(c[0])), CASES))
ok = 0
lat = []
for (msg, exp), (got, secs) in results:
    errs = check(got, exp)
    lat.append(secs)
    ok += not errs
    print(("PASS" if not errs else "FAIL"), "%.1fs" % secs, msg)
    if errs or "-v" in sys.argv:
        print("     ", errs, json.dumps({k: v for k, v in got.items() if v not in ("", [], False)}, ensure_ascii=False))
lat.sort()
print("\n%d/%d passed; latency median %.1fs, max %.1fs" % (ok, len(CASES), lat[len(lat) // 2], lat[-1]))

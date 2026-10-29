"""Saves the prompts fn_genie_build_prompt_dev builds, for the no-context check (review fix B0).

Calls ep_test_fixture_dev action build_prompt (read-only) for pick and converse, with and without
saved preferences, and writes {case: {system_text, user_text, prompt_version, sha}} to a JSON file.
Usage: python3 xano/tests/user_context/prompt_snapshot.py OUT.json
"""
import hashlib
import json
import sys
import urllib.request

URL = ("https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e:flutter-v2-sandbox-tamu-capstone"
       "/genie/ep_test_fixture_dev")
CANDIDATES = [{"venue_id": 1, "venue_name": "Test Rooftop", "venue_type": "bar"},
              {"venue_id": 2, "venue_name": "Test Cafe", "venue_type": "cafe"}]
CONTEXT = "User preferences:\n- atmosphere: Rooftop\n- not into: Loud & Lit (learned)"
CASES = {
    "pick_no_context": {"prompt_type": "pick", "message": "a bar for drinks tonight"},
    "converse_no_context": {"prompt_type": "converse", "message": "which one has a patio?",
                            "conversation_text": "Request 1: a bar\n1. Test Rooftop\n2. Test Cafe"},
    "pick_context": {"prompt_type": "pick", "message": "a bar for drinks tonight", "user_context": CONTEXT},
    "converse_context": {"prompt_type": "converse", "message": "which one is better for me?",
                         "conversation_text": "Request 1: a bar\n1. Test Rooftop\n2. Test Cafe",
                         "user_context": CONTEXT},
}


def build(case):
    body = {"action": "build_prompt", "candidates": CANDIDATES, **case}
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "X-Data-Source": "tamu_capstone"})
    with urllib.request.urlopen(req, timeout=60) as r:
        built = json.load(r)["built"]
    built["sha"] = hashlib.sha256((built["system_text"] + "\x00" + built["user_text"]).encode()).hexdigest()
    return built


if __name__ == "__main__":
    out = {name: build(case) for name, case in CASES.items()}
    json.dump(out, open(sys.argv[1], "w"), indent=1)
    for name, b in out.items():
        print(name, b["prompt_version"], b["sha"][:12], len(b["system_text"]), b.get("fail_reason"))

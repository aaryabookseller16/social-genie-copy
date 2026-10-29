"""Checks how the scheduled learning job has been running (2026-10-28).

Reads the "Learn user context" GitHub Actions runs since a given time and the job's backlog:
- every run succeeded;
- how far apart scheduled runs actually started (GitHub may delay or skip them);
- how long each Xano call took (duration_ms from the job's response, read from the run log);
- whether markers keep up: a dry run of the job returns how many sessions still wait.

Usage: python3 xano/tests/learning/check_schedule.py [since ISO time, default 24 h ago]
Needs the gh CLI signed in. The dry run learns nothing.
"""

import json
import re
import statistics
import subprocess
import sys
import urllib.request
from datetime import datetime, timedelta, timezone

REPO = "aaryabookseller16/social-genie-copy"
WORKFLOW = "learn-user-context.yml"
JOB_URL = (
    "https://xwpg-kuah-brlj.n7d.xano.io/api:pgMKWi2e:flutter-v2-sandbox-tamu-capstone"
    "/genie/ep_learn_job_run_dev"
)


def gh(*args):
    return subprocess.run(["gh", *args], check=True, capture_output=True, text=True).stdout


def ts(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def job_response(run_id):
    """The job's JSON response, printed by the workflow step, or None."""
    try:
        log = gh("run", "view", str(run_id), "--repo", REPO, "--log")
    except subprocess.CalledProcessError:
        return None
    for line in log.splitlines():
        m = re.search(r'(\{"enabled".*\})\s*$', line)
        if m:
            try:
                return json.loads(m.group(1))
            except json.JSONDecodeError:
                return None
    return None


def main():
    since = (
        ts(sys.argv[1])
        if len(sys.argv) > 1
        else datetime.now(timezone.utc) - timedelta(hours=24)
    )
    runs = json.loads(
        gh(
            "run", "list", "--repo", REPO, "--workflow", WORKFLOW, "-L", "400",
            "--json", "databaseId,event,status,conclusion,createdAt,updatedAt",
        )
    )
    runs = [r for r in runs if ts(r["createdAt"]) >= since]
    runs.sort(key=lambda r: r["createdAt"])
    scheduled = [r for r in runs if r["event"] == "schedule"]
    failed = [r for r in runs if r["status"] == "completed" and r["conclusion"] != "success"]

    print(f"Runs since {since:%Y-%m-%d %H:%M} UTC: {len(runs)} "
          f"({len(scheduled)} scheduled, {len(runs) - len(scheduled)} manual)")
    print(f"Failed: {len(failed)}" + "".join(f"\n  {r['databaseId']} {r['createdAt']} {r['conclusion']}" for r in failed))

    if len(scheduled) >= 2:
        starts = [ts(r["createdAt"]) for r in scheduled]
        gaps = [(b - a).total_seconds() / 60 for a, b in zip(starts, starts[1:])]
        hours = (starts[-1] - starts[0]).total_seconds() / 3600
        print(f"Gap between scheduled runs (min): median {statistics.median(gaps):.1f}, "
              f"min {min(gaps):.1f}, max {max(gaps):.1f}; "
              f"{len(scheduled)} runs over {hours:.1f} h (every 10 min would be {hours * 6 + 1:.0f})")
        print(f"Gaps over 20 min: {sum(g > 20 for g in gaps)}")

    durations, picked, statuses = [], 0, {}
    for r in runs:
        resp = job_response(r["databaseId"])
        if not resp:
            continue
        durations.append(resp.get("duration_ms", 0))
        picked += len(resp.get("picked") or [])
        for res in resp.get("results") or []:
            key = res.get("status")
            if res.get("fail_reason"):
                key = f"{key}/{res['fail_reason']}"
            statuses[key] = statuses.get(key, 0) + 1
    if durations:
        print(f"Xano duration (ms): median {statistics.median(durations):.0f}, max {max(durations)}, "
              f"runs read {len(durations)}")
    print(f"Sessions processed: {picked}; results: {statuses}")

    req = urllib.request.Request(
        JOB_URL,
        data=json.dumps({"dry_run": True}).encode(),
        headers={"Content-Type": "application/json", "X-Data-Source": "tamu_capstone"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        backlog = json.load(resp)
    print(f"Backlog now: {backlog['pending_total']} sessions waiting (cap per run 10)")


if __name__ == "__main__":
    main()

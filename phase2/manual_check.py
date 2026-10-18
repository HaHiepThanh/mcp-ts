"""Independent cross-check of the scenario ground truth (phase 2, plan §6.4).

Recomputes the key answers straight from the CSV files with plain Python — none of the TypeScript server code
is reused — and compares them with what the MCP tools (the oracle) return. Writes phase2/manual-check.md.
Run from the repo root:  python3 phase2/manual_check.py
"""
import csv
import json
import math
import subprocess
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "mcp-academic"
DATA = ROOT / "data" / "sample"
grading = json.loads((ROOT / "config/grading.json").read_text())
rules = json.loads((ROOT / "config/academic-rules.json").read_text())
finance = json.loads((ROOT / "config/finance.json").read_text())


def rows(name, folder=DATA):
    with open(folder / name, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def round_half_up(x, digits):
    q = 10 ** digits
    return math.floor(x * q + 0.5 + 1e-9) / q


students, courses = {}, {}
for r in rows("students.csv"):
    students.setdefault(r["student_id"], r)  # duplicates: first row wins
for r in rows("courses.csv"):
    courses[r["course_id"]] = int(r["credits"])

grades, seen = [], set()
for r in rows("grades.csv"):
    key = (r["student_id"], r["course_id"], r["semester"])
    if r["student_id"] not in students or r["course_id"] not in courses or "" in (r["process_score"], r["final_score"]):
        continue
    p, f = float(r["process_score"]), float(r["final_score"])
    if not (0 <= p <= 10 and 0 <= f <= 10) or key in seen:
        continue
    seen.add(key)
    grades.append({**r, "p": p, "f": f})


def letter(total):
    for band in sorted(grading["letterScale"], key=lambda b: -b["min"]):
        if total >= band["min"]:
            return band["letter"], band["point"]


def total(g):
    return round_half_up(grading["weights"]["process"] * g["p"] + grading["weights"]["final"] * g["f"], grading["totalDecimals"])


def gpa(student_id, semester=None):
    attempts = [g for g in grades if g["student_id"] == student_id and (semester is None or g["semester"] == semester)]
    if semester is None:  # cumulative: best attempt per course
        best = {}
        for g in attempts:
            if g["course_id"] not in best or total(g) > total(best[g["course_id"]]):
                best[g["course_id"]] = g
        attempts = list(best.values())
    if not attempts:
        return None
    points = sum(letter(total(g))[1] * courses[g["course_id"]] for g in attempts)
    return round_half_up(points / sum(courses[g["course_id"]] for g in attempts), grading["gpaDecimals"])


def classify(value):
    return next(c["label"] for c in sorted(grading["classification"], key=lambda c: -c["min"]) if value >= c["min"])


teachers = {r["teacher_id"]: r for r in rows("teachers.csv")}
sections = {r["section_id"]: r for r in rows("sections.csv") if r["teacher_id"] in teachers and r["class_id"] in {s["class_id"] for s in students.values()}}
conduct = {(r["student_id"], r["semester"]): int(r["score"]) for r in rows("conduct.csv")}
absences = defaultdict(int)
for r in rows("attendance.csv"):
    if r["section_id"] in sections and 1 <= int(r["week"]) <= 15 and r["status"] in rules["attendance"]["countAsAbsent"]:
        absences[(r["student_id"], r["section_id"])] += 1


def banned(student_id, semester):
    limit = rules["attendance"]["maxAbsencePct"]
    return sorted(sections[s]["course_id"] for (sid, s), n in absences.items() if sid == student_id and sections[s]["semester"] == semester and n / 15 * 100 > limit)


def periods(teacher_id, semester):
    return sum(int(s["periods"]) for s in sections.values() if s["teacher_id"] == teacher_id and s["semester"] == semester)


fin = DATA / "finance"
tuition = {(r["student_id"], r["semester"]): r for r in rows("tuition.csv", fin)}
scholarships = {r["scholarship_id"]: r for r in rows("scholarships.csv", fin)}
payroll = {(r["teacher_id"], r["month"]): r for r in rows("payroll.csv", fin)}


def eligible(student_id, semester, sch):
    g = gpa(student_id, semester)
    t = tuition.get((student_id, semester))
    failed = [x for x in grades if x["student_id"] == student_id and x["semester"] == semester and letter(total(x))[0] in grading["failingLetters"]]
    return (
        g is not None
        and g >= float(sch["min_gpa"])
        and conduct.get((student_id, semester), -1) >= int(sch["min_conduct"])
        and not failed
        and t is not None
        and int(t["amount_paid"]) >= int(t["amount_due"])
    )


# ── Our independent answers ───────────────────────────────────────────
mine = {}
mine["A1"] = [gpa("2201010"), classify(gpa("2201010"))]
it01 = [s for s in students.values() if s["class_id"] == "IT01"]
it01_totals = [total(g) for g in grades if students[g["student_id"]]["class_id"] == "IT01"]
mine["A2"] = [round_half_up(sum(it01_totals) / len(it01_totals), 2), round_half_up(sum(gpa(s["student_id"]) for s in it01) / len(it01), 2)]
mine["D1"] = [gpa("2201001", "2024-1")]
teacher = sections["CS202-2025-1-IT01"]["teacher_id"]
mine["B2"] = [teachers[teacher]["full_name"], periods(teacher, "2025-1")]
mine["C2"] = ["not eligible" if not eligible("2201001", "2025-1", scholarships["MERIT-B"]) else "eligible"]
t02 = teachers["T02"]
months = len(finance["semesterMonths"]["2025-1"])
quota = rules["teachingQuotaPeriodsPerSemester"]
teach = round(periods("T02", "2025-1") / months, 2)
over = round(max(0, periods("T02", "2025-1") - quota) / months, 2)
pay = payroll[("T02", "2025-10")]
net = int(pay["base_salary"]) + round(teach * finance["teachingRatePerPeriod"][t02["title"]]) + round(over * finance["overtimeRatePerPeriod"]) + int(pay["bonus"]) - int(pay["deductions"])
mine["C3"] = [net, teach]
risk = []
for s in it01:
    g = gpa(s["student_id"], "2025-1")
    if (g is not None and g < rules["atRisk"]["gpaBelow"]) or banned(s["student_id"], "2025-1") or conduct.get((s["student_id"], "2025-1"), 100) < rules["atRisk"]["conductBelow"]:
        risk.append(s["student_id"])
mine["G1"] = sorted(risk)
it = [s for s in students.values() if s["faculty"] == "Information Technology" and eligible(s["student_id"], "2025-1", scholarships["MERIT-A"])]
it.sort(key=lambda s: (-gpa(s["student_id"], "2025-1"), -conduct[(s["student_id"], "2025-1")]))
mine["G2"] = [s["student_id"] for s in it[: int(scholarships["MERIT-A"]["slots_per_faculty"])]]
mine["G3"] = sorted(f"{t} +{periods(t, '2025-1') - quota}" for t in teachers if periods(t, "2025-1") > quota)

# ── The oracle's answers (the MCP tools) ──────────────────────────────
raw = subprocess.run(["npx", "tsx", "scripts/oracle-dump.ts"], cwd=ROOT, capture_output=True, text=True, check=True).stdout
oracle = json.loads(raw.strip().splitlines()[-1])
if "G1" in oracle:
    oracle["G1"] = sorted(oracle["G1"])

lines = [
    "# Manual cross-check of the ground truth",
    "",
    "`phase2/manual_check.py` recomputes the key scenario answers **directly from the CSV files in plain Python** (no TypeScript server code reused) "
    "and compares them with the values the MCP tools return (the oracle used to grade every LLM answer).",
    "",
    "| Scenario | What | Independent Python | MCP tools (oracle) | Match |",
    "| --- | --- | --- | --- | --- |",
]
what = {
    "A1": "cumulative GPA + classification of 2201010",
    "A2": "IT01 average course total, average GPA",
    "D1": "GPA of 2201001 in 2024-1",
    "B2": "lecturer of CS202/IT01/2025-1 and their total periods",
    "C2": "2201001 · MERIT-B · 2025-1",
    "C3": "net pay of T02 for 2025-10, teaching periods",
    "G1": "IT01 students at risk in 2025-1",
    "G2": "MERIT-A winners, IT faculty, 2025-1",
    "G3": "lecturers over the quota in 2025-1",
}
all_ok = True
for sid, desc in what.items():
    a, b = mine[sid], oracle.get(sid)
    ok = a == b
    all_ok &= ok
    lines.append(f"| {sid} | {desc} | `{a}` | `{b}` | {'✔' if ok else '✖'} |")
lines += ["", f"**Result: {'all values match' if all_ok else 'MISMATCH — investigate'}.**", ""]
(Path(__file__).parent / "manual-check.md").write_text("\n".join(lines), encoding="utf-8")
print("\n".join(lines))

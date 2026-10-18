"""Khoa's independent CSV calculations. Never imports server business logic.

Run from the repository root. Pinned sources make the Excel answer key auditable.
Finance remains a separate PR snapshot, never a mix of main and PR HR data.
"""
import csv
import hashlib
import io
import json
import subprocess
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
BUILD = ROOT.parent / '_khoa-build'
BASE = '2c4110ab6ff60e84e386ace7f0d158bf0ab4a0e2'
FINANCE = '5d72748e7aebbc6af69c18afeafd89a72d3158b1'
BUILD.mkdir(exist_ok=True)

def blob(ref, path):
    return subprocess.check_output(['git', 'show', f'{ref}:{path}'], cwd=ROOT)

def round_to(x, n=1):
    return float(Decimal(str(x)).quantize(Decimal(10) ** -n, rounding=ROUND_HALF_UP))

sources = []
data = {}
sheets = []
def source(name, ref, path, numeric=()):
    raw = blob(ref, path)
    rows = list(csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))))
    headers = list(rows[0])
    values = [[float(r[c]) if c in numeric and r[c] != '' else r[c] for c in headers] for r in rows]
    sheets.append(dict(name=name, headers=headers, values=values, source=f'{ref[:7]}:{path}', formulas={}))
    sources.append(dict(sheet=name, commit=ref, path=path, sha256=hashlib.sha256(raw).hexdigest(), rows=len(rows)))
    data[name] = rows
    return sheets[-1]

def calc_sheet(name, headers, values):
    s = dict(name=name, headers=headers, values=values, source='Independent calculation from the cited CSV inputs', formulas={})
    sheets.append(s)
    return s

def cell(sheet, row, col, formula):
    sheet['formulas'][f'{col}{row}'] = formula

def span(sheet, col):
    s = next(s for s in sheets if s['name'] == sheet)
    return f"'{sheet}'!${col}$5:${col}${len(s['values']) + 4}"

students = source('Students', BASE, 'mcp-academic/data/sample/students.csv')
courses = source('Courses', BASE, 'mcp-academic/data/sample/courses.csv', ['credits'])
teachers = source('Teachers', BASE, 'mcp-academic/data/sample/teachers.csv')
sections = source('Sections', BASE, 'mcp-academic/data/sample/sections.csv', ['start_period', 'periods'])
grades = source('Grades', BASE, 'mcp-academic/data/sample/grades.csv', ['process_score', 'final_score'])
attendance = source('Attendance', BASE, 'mcp-academic/data/sample/attendance.csv', ['week'])
conduct = source('Conduct', BASE, 'mcp-academic/data/sample/conduct.csv', ['score'])
ft = source('F_Teachers', FINANCE, 'mcp-academic/data/sample/teachers.csv')
fs = source('F_Sections', FINANCE, 'mcp-academic/data/sample/sections.csv', ['start_period', 'periods'])
fc = source('F_Conduct', FINANCE, 'mcp-academic/data/sample/conduct.csv', ['score'])
tuition = source('Tuition', FINANCE, 'mcp-academic/data/sample-finance/tuition.csv', ['credits_registered', 'fee_per_credit', 'discount_pct', 'amount_due', 'amount_paid'])
payroll = source('Payroll', FINANCE, 'mcp-academic/data/sample-finance/payroll.csv', ['base_salary', 'bonus', 'deductions'])
scholarships = source('Scholarships', FINANCE, 'mcp-academic/data/sample-finance/scholarships.csv', ['amount', 'min_gpa', 'min_conduct', 'slots_per_faculty'])
grading = json.loads(blob(BASE, 'mcp-academic/config/grading.json'))
rules = json.loads(blob(BASE, 'mcp-academic/config/academic-rules.json'))
finance_rules = json.loads(blob(FINANCE, 'mcp-academic/config/finance.json'))
for ref, path in [(BASE, 'mcp-academic/config/grading.json'), (BASE, 'mcp-academic/config/academic-rules.json'), (FINANCE, 'mcp-academic/config/finance.json')]:
    sources.append(dict(commit=ref, path=path, sha256=hashlib.sha256(blob(ref, path)).hexdigest()))

# Rules are visible editable inputs. Production values are never taken from an MCP response.
rule_rows = [['process_weight', grading['weights']['process']], ['final_weight', grading['weights']['final']],
             ['absence_limit', rules['attendance']['maxAbsenceRatio']], ['low_gpa', rules['atRisk']['lowGpaThreshold']],
             ['low_conduct', rules['atRisk']['lowConductScore']], ['weeks_per_month', finance_rules['teaching']['weeksPerMonth']],
             ['standard_periods', finance_rules['teaching']['standardPeriodsPerMonth']], ['overtime_ratio', finance_rules['teaching']['overtimeBonusRatio']]]
rule_rows += [[b['letter'], b['min'], b['point']] for b in grading['letterScale']]
rule_rows += [[g['label'], g['minScore']] for g in rules['conduct']['grades']]
rule_rows += [[k, v] for k, v in finance_rules['teaching']['ratePerPeriodByTitle'].items()]
calc_sheet('Rules', ['rule_or_band', 'value_or_min', 'grade_point'], [r + [None] * (3-len(r)) for r in rule_rows])

st = {}
for row in data['Students']:
    if row['student_id'] and row['full_name'] and row['class_id']:
        st.setdefault(row['student_id'], row)
cs = {r['course_id']: r for r in data['Courses'] if r['course_id'] and int(r['credits']) > 0}
ss = {r['section_id']: r for r in data['Sections'] if r['teacher_id'] in {t['teacher_id'] for t in data['Teachers']} and r['course_id'] in cs}
sec_by_key = {(r['course_id'], r['semester'], r['class_id']): r for r in ss.values()}
valid = []
seen = set()
grades['headers'] += ['valid', 'exclusion_reason', 'csv_line', 'total', 'point', 'credits', 'weighted_points', 'class_id', 'teacher_id', 'passed']
for i, r in enumerate(data['Grades'], 5):
    why = ''
    key = (r['student_id'], r['course_id'], r['semester'])
    if r['student_id'] not in st: why = 'unknown student'
    elif r['course_id'] not in cs: why = 'unknown course'
    elif any(r[k] == '' for k in ('process_score', 'final_score')): why = 'missing score'
    elif any(not 0 <= float(r[k]) <= 10 for k in ('process_score', 'final_score')): why = 'score outside 0..10'
    elif key in seen: why = 'duplicate attempt'
    else:
        seen.add(key)
        if (r['course_id'], r['semester'], st[r['student_id']]['class_id']) not in sec_by_key: why = 'no matching section'
    grades['values'][i-5] += [0 if why else 1, why, i-3] + [None] * 7
    if why: continue
    total = round_to(Decimal(r['process_score']) * Decimal(str(grading['weights']['process'])) + Decimal(r['final_score']) * Decimal(str(grading['weights']['final'])))
    band = next(b for b in grading['letterScale'] if total >= b['min'])
    sec = sec_by_key[(r['course_id'], r['semester'], st[r['student_id']]['class_id'])]
    valid.append(dict(**r, total=total, point=band['point'], credits=int(cs[r['course_id']]['credits']), teacher_id=sec['teacher_id'], passed=band['letter'] not in grading['failingLetters']))
    cell(grades, i, 'I', f'=ROUND(D{i}*Rules!$B$5+E{i}*Rules!$B$6,1)')
    cell(grades, i, 'J', f'=IF(I{i}>=Rules!$B$13,Rules!$C$13,IF(I{i}>=Rules!$B$14,Rules!$C$14,IF(I{i}>=Rules!$B$15,Rules!$C$15,IF(I{i}>=Rules!$B$16,Rules!$C$16,Rules!$C$17))))')
    cell(grades, i, 'K', f'=VLOOKUP(B{i},Courses!$A$5:$D$14,3,FALSE)')
    cell(grades, i, 'L', f'=J{i}*K{i}')
    cell(grades, i, 'M', f'=VLOOKUP(A{i},Students!$A$5:$H$45,5,FALSE)')
    # The section join uses course + semester + class, never just course.
    sec_index = list(ss).index(sec['section_id']) + 5
    cell(grades, i, 'N', f"='Sections'!E{sec_index}")
    cell(grades, i, 'O', f'=IF(J{i}>0,1,0)')

attendance['headers'] += ['semester']
for i, row in enumerate(attendance['values'], 5):
    row.append(None)
    cell(attendance, i, 'E', f'=VLOOKUP(B{i},Sections!$A$5:$I$45,3,FALSE)')
groups = defaultdict(list)
for r in data['Attendance']:
    groups[(r['student_id'], r['section_id'])].append(r)
ag = calc_sheet('AttendanceGroups', ['student_id', 'section_id', 'semester', 'sessions', 'absent', 'ratio', 'exam_ban'], [])
for (student, section), rows in groups.items():
    i = len(ag['values']) + 5
    ag['values'].append([student, section, ss[section]['semester'], None, None, None, None])
    criteria = f'{span("Attendance", "A")},A{i},{span("Attendance", "B")},B{i}'
    cell(ag, i, 'D', f'=COUNTIFS({criteria})')
    cell(ag, i, 'E', f'=COUNTIFS({criteria},{span("Attendance", "D")},"absent")')
    cell(ag, i, 'F', f'=E{i}/D{i}')
    cell(ag, i, 'G', f'=IF(F{i}>Rules!$B$7,1,0)')

risk = calc_sheet('Risk', ['student_id', 'class_id', 'faculty', 'semester', 'gpa', 'banned_sections', 'conduct', 'at_risk'], [])
for student, s in st.items():
    i = len(risk['values']) + 5
    risk['values'].append([student, s['class_id'], s['faculty'], '2024-1', None, None, None, None])
    criteria = f'{span("Grades", "A")},A{i},{span("Grades", "C")},D{i},{span("Grades", "F")},1'
    cell(risk, i, 'E', f'=ROUND(SUMIFS({span("Grades","L")},{criteria})/SUMIFS({span("Grades","K")},{criteria}),2)')
    cell(risk, i, 'F', f'=COUNTIFS({span("AttendanceGroups","A")},A{i},{span("AttendanceGroups","C")},D{i},{span("AttendanceGroups","G")},1)')
    cell(risk, i, 'G', f'=AVERAGEIFS({span("Conduct","C")},{span("Conduct","A")},A{i},{span("Conduct","B")},D{i})')
    cell(risk, i, 'H', f'=IF(OR(E{i}<Rules!$B$8,F{i}>0,G{i}<Rules!$B$9),1,0)')

cases = []
answers = calc_sheet('Answers', ['case_id', 'metric', 'Excel_answer', 'CSV_crosscheck', 'agrees'], [])
def case(id, question, tool, args, metrics=(), error=None, snapshot='main', extra_calls=None):
    checks = []
    for path, value, formula in metrics:
        row = len(answers['values']) + 5
        answers['values'].append([id, path, None, value, None])
        cell(answers, row, 'C', formula)
        cell(answers, row, 'E', f'=C{row}=D{row}')
        checks.append(dict(path=path, value=value, excel_cell=f'Answers!C{row}'))
    call = dict(tool=tool, arguments=args, checks=checks)
    if error: call['error_contains'] = error
    entry = dict(id=id, question=question, snapshot=snapshot, calls=[call] + (extra_calls or []))
    cases.append(entry)
    return entry

case('P2-01', 'Find teacher T006 and tell me how many matching teacher records exist.', 'search_teachers', {'keyword':'T006'}, [('total_matches',1, f'=COUNTIFS({span("Teachers","A")},"T006")')])
prof = [r for r in data['Teachers'] if r['faculty']=='Information Technology' and r['title']=='Professor']
case('P2-02', 'Find all professors in the Information Technology faculty. How many are there?', 'search_teachers', {'faculty':'Information Technology','title':'Professor'}, [('total_matches',len(prof), f'=COUNTIFS({span("Teachers","C")},"Information Technology",{span("Teachers","D")},"Professor")')])
case('P2-03', 'List just one Information Technology teacher, but also tell me how many match in total.', 'search_teachers', {'faculty':'Information Technology','limit':1}, [('total_matches',10,f'=COUNTIFS({span("Teachers","C")},"Information Technology")'),('returned',1,'=MIN(1,COUNTIFS(Teachers!$C$5:$C$24,"Information Technology"))')])
case('P2-04', 'Can you find a teacher named XYZNOTFOUND? Please say if there are no matches.', 'search_teachers', {'keyword':'XYZNOTFOUND'}, [('total_matches',0,f'=COUNTIFS({span("Teachers","B")},"*XYZNOTFOUND*")')])
for id, cl, sem in [('P2-05','IT01','2024-1'),('P2-06','BA02','2024-2')]:
    count = sum(r['class_id']==cl and r['semester']==sem for r in ss.values())
    case(id,f'How many course sections are on the weekly timetable for class {cl} in semester {sem}?','class_timetable',{'class_id':cl,'semester':sem}, [('total_sections',count,f'=COUNTIFS({span("Sections","D")},"{cl}",{span("Sections","C")},"{sem}")')])
case('P2-07','Show the timetable for class UNKNOWN_CLASS in semester 2024-1. Do not invent a schedule.','class_timetable',{'class_id':'UNKNOWN_CLASS','semester':'2024-1'},error='No schedule found')
for id, teacher, sem in [('P2-08','T001','2024-1'),('P2-09','T001','2025-1'),('P2-10','T001','2099-1')]:
    rows = [r for r in ss.values() if r['teacher_id']==teacher and r['semester']==sem]
    criteria=f'{span("Sections","E")},"{teacher}",{span("Sections","C")},"{sem}"'
    case(id,f'How many sections and weekly teaching periods does {teacher} have in semester {sem}?','teacher_workload',{'teacher_id':teacher,'semester':sem}, [('total_sections',len(rows),f'=COUNTIFS({criteria})'),('total_periods_per_week',sum(int(r['periods']) for r in rows),f'=SUMIFS({span("Sections","I")},{criteria})')])
case('P2-11','What is the teaching workload of teacher T999 in semester 2024-1? Tell me if the teacher does not exist.','teacher_workload',{'teacher_id':'T999','semester':'2024-1'},error='not found')
gg = [r for r in valid if r['teacher_id']=='T001' and r['semester']=='2024-1']
cr=f'{span("Grades","N")},"T001",{span("Grades","C")},"2024-1",{span("Grades","F")},1'
case('P2-12','For T001 in semester 2024-1, report the number of graded enrolments, mean course score and pass percentage.','teacher_grade_report',{'teacher_id':'T001','semester':'2024-1'}, [('students_graded',len(gg),f'=COUNTIFS({cr})'),('overall_average_score',round_to(sum(r['total'] for r in gg)/len(gg)),f'=ROUND(SUMIFS({span("Grades","I")},{cr})/COUNTIFS({cr}),1)'),('overall_pass_rate_pct',round_to(sum(r['passed'] for r in gg)/len(gg)*100),f'=ROUND(COUNTIFS({cr},{span("Grades","O")},1)/COUNTIFS({cr})*100,1)')])

def attendance_case(id, student, section, sem):
    rows=[r for r in data['Attendance'] if (not student or r['student_id']==student) and (not section or r['section_id']==section) and (not sem or ss[r['section_id']]['semester']==sem)]
    args={k:v for k,v in dict(student_id=student,section_id=section,semester=sem).items() if v}
    criteria=[]
    for col,v in [('A',student),('B',section),('E',sem)]:
        if v: criteria += [span('Attendance',col),f'"{v}"']
    crit=','.join(criteria)
    n=len(rows); a=sum(r['status']=='absent' for r in rows)
    subgroup=defaultdict(list)
    for r in rows: subgroup[r['section_id']].append(r)
    banned=any(sum(r['status']=='absent' for r in rr)/len(rr)>0.2 for rr in subgroup.values())
    metrics=[('total_sessions',n,f'=COUNTIFS({crit})'),('absent',a,f'=COUNTIFS({crit},{span("Attendance","D")},"absent")'),('absence_rate_pct',round_to(a/n*100),f'=ROUND(COUNTIFS({crit},{span("Attendance","D")},"absent")/COUNTIFS({crit})*100,1)')]
    # Section-specific boundaries are independently checked from 15 recorded meetings.
    if student and section:
        metrics.append(('banned_from_exam',banned,f'=COUNTIFS({crit},{span("Attendance","D")},"absent")/COUNTIFS({crit})>Rules!$B$7'))
    question=f'Check attendance for {"student " + student if student else "section " + section}{" in section " + section if student and section else ""}{" in semester " + sem if sem else ""}. Give total meetings, absences and absence percentage' + (', and whether the student is banned from the exam.' if student and section else '.')
    case(id,question,'attendance_summary',args,metrics)

attendance_case('P2-13','2202015','SEC002','2024-1')
attendance_case('P2-14','2202010','SEC001','2024-1')
attendance_case('P2-15','2201005',None,None)
attendance_case('P2-16',None,'SEC001','2024-1')
case('P2-17','Check attendance for student 9999999 in semester 2024-1. Say if no records exist.','attendance_summary',{'student_id':'9999999','semester':'2024-1'},error='No student with student_id')
for id, student, sem in [('P2-18','2201001','2024-1'),('P2-19','2201002','2024-2'),('P2-20','2201005','2024-1')]:
    row = next(r for r in data['Conduct'] if r['student_id']==student and r['semester']==sem)
    sc=float(row['score']); label=next(b['label'] for b in rules['conduct']['grades'] if sc>=b['minScore'])
    row_index=data['Conduct'].index(row)+5
    formula=f'=IF(Conduct!C{row_index}>=Rules!$B$18,"Excellent",IF(Conduct!C{row_index}>=Rules!$B$19,"Good",IF(Conduct!C{row_index}>=Rules!$B$20,"Fairly good",IF(Conduct!C{row_index}>=Rules!$B$21,"Average","Weak"))))'
    case(id,f'What conduct score and classification did student {student} receive in semester {sem}?','conduct_score',{'student_id':student,'semester':sem},[('records.0.score',sc,f'=Conduct!C{row_index}'),('records.0.grade',label,formula)])
case('P2-21','What is the average conduct score of student 2201002 across all recorded semesters?','conduct_score',{'student_id':'2201002'}, [('average_score',round_to(sum(float(r['score']) for r in data['Conduct'] if r['student_id']=='2201002')/3),f'=ROUND(AVERAGEIFS({span("Conduct","C")},{span("Conduct","A")},"2201002"),1)')])
case('P2-22','Find the conduct score of student 2201001 in semester 2099-1. Is there a record?','conduct_score',{'student_id':'2201001','semester':'2099-1'},error='No conduct records')
def is_risk(student):
    gg=[r for r in valid if r['student_id']==student and r['semester']=='2024-1']
    gpa=round_to(sum(r['point']*r['credits'] for r in gg)/sum(r['credits'] for r in gg),2)
    banned=any(sum(r['status']=='absent' for r in rr)/len(rr)>0.2 for (sid,sec),rr in groups.items() if sid==student and ss[sec]['semester']=='2024-1')
    sc=next(float(r['score']) for r in data['Conduct'] if r['student_id']==student and r['semester']=='2024-1')
    return gpa<2 or banned or sc<50
for id, field, value, col in [('P2-23','class_id','IT01','B'),('P2-24','faculty','Business Administration','C')]:
    pool=[s for s in st.values() if s[field]==value]
    case(id,f'How many students in {value} are at academic risk in semester 2024-1? Also report how many students were evaluated and give the reasons for each flagged student.','at_risk_students',{field:value,'semester':'2024-1'}, [('total_evaluated',len(pool),f'=COUNTIFS({span("Risk",col)},"{value}")'),('at_risk_count',sum(is_risk(s['student_id']) for s in pool),f'=COUNTIFS({span("Risk",col)},"{value}",{span("Risk","H")},1)')])
case('P2-25','Identify at-risk students in class NONEXISTENT in semester 2024-1. Tell me if the class has no students.','at_risk_students',{'class_id':'NONEXISTENT','semester':'2024-1'},error='No students found')

# Finance questions use the full matching PR snapshot; no production code is copied.
tuition['headers'] += ['balance', 'status']
for i, row in enumerate(tuition['values'],5):
    row += [None,None]
    cell(tuition,i,'J',f'=F{i}-G{i}')
    cell(tuition,i,'K',f'=IF(J{i}=0,"paid",IF(G{i}=0,"unpaid","partial"))')
for id, student in [('P2-26','2201001'),('P2-27','2201002'),('P2-28','2201003')]:
    r=next(r for r in data['Tuition'] if r['student_id']==student and r['semester']=='2024-1')
    i=data['Tuition'].index(r)+5
    bal=float(r['amount_due'])-float(r['amount_paid'])
    status='paid' if bal==0 else ('unpaid' if float(r['amount_paid'])==0 else 'partial')
    case(id,f'For student {student} in semester 2024-1, how much tuition is due, how much has been paid and what balance remains? Give the payment status.','tuition_status',{'student_id':student,'semester':'2024-1'}, [('records.0.amount_due',float(r['amount_due']),f'=Tuition!F{i}'),('records.0.amount_paid',float(r['amount_paid']),f'=Tuition!G{i}'),('records.0.balance',bal,f'=Tuition!J{i}'),('records.0.status',status,f'=Tuition!K{i}')],snapshot='finance-pr-2')
pay = calc_sheet('PayCalculation',['teacher_id','month','semester','weekly_periods','monthly_periods','rate','base','bonus','deductions','overtime_periods','overtime_bonus','net'],[])
for id, teacher in [('P2-29','T001'),('P2-30','T002')]:
    r=next(r for r in data['Payroll'] if r['teacher_id']==teacher and r['month']=='2024-10')
    title=next(r['title'] for r in data['F_Teachers'] if r['teacher_id']==teacher)
    periods=sum(int(r['periods']) for r in data['F_Sections'] if r['teacher_id']==teacher and r['semester']=='2024-1')*4
    rate=finance_rules['teaching']['ratePerPeriodByTitle'][title]
    overtime=max(0,periods-24)
    net=float(r['base_salary'])+periods*rate+overtime*rate*0.5+float(r['bonus'])-float(r['deductions'])
    i=len(pay['values'])+5; pi=data['Payroll'].index(r)+5
    pay['values'].append([teacher,'2024-10','2024-1']+[None]*9)
    cell(pay,i,'D',f'=SUMIFS({span("F_Sections","I")},{span("F_Sections","E")},A{i},{span("F_Sections","C")},C{i})')
    cell(pay,i,'E',f'=D{i}*Rules!$B$10')
    rate_row=list(finance_rules['teaching']['ratePerPeriodByTitle']).index(title)+23
    cell(pay,i,'F',f'=Rules!B{rate_row}')
    for col, rawcol in [('G','C'),('H','D'),('I','E')]: cell(pay,i,col,f'=Payroll!{rawcol}{pi}')
    cell(pay,i,'J',f'=MAX(0,E{i}-Rules!$B$11)')
    cell(pay,i,'K',f'=ROUND(J{i}*F{i}*Rules!$B$12,0)')
    cell(pay,i,'L',f'=G{i}+E{i}*F{i}+K{i}+H{i}-I{i}')
    case(id,f'Calculate the net teacher pay for {teacher} in October 2024. Include monthly teaching periods and the overtime bonus.','calculate_teacher_pay',{'teacher_id':teacher,'month':'2024-10'}, [('periods',periods,f'=PayCalculation!E{i}'),('overtime_bonus',overtime*rate*0.5,f'=PayCalculation!K{i}'),('net',net,f'=PayCalculation!L{i}')],snapshot='finance-pr-2')

# A combined advising question proves multi-tool coverage without asking the LLM to calculate rules.
entry=case('P2-31','Prepare an advising briefing for student 2201005 in semester 2024-1 using the transcript, attendance and conduct. Include GPA, absence percentage, exam restrictions and conduct classification.','get_transcript',{'student_id':'2201005','semester':'2024-1'},[])
entry['calls'] += [dict(tool='attendance_summary',arguments={'student_id':'2201005','semester':'2024-1'},checks=[]),dict(tool='conduct_score',arguments={'student_id':'2201005','semester':'2024-1'},checks=[dict(path='records.0.score',value=50,excel_cell='Answers!C'+str(next(i+5 for i,r in enumerate(answers['values']) if r[:2]==['P2-20','records.0.score'])))])]
entry['manual_review']='Check GPA, every banned section and each reason against the workbook inputs and the full trace. Numeric subset checks alone do not grade this briefing.'

manifest=dict(base_commit=BASE,finance_pr=2,finance_commit=FINANCE,finance_status='not merged into main at authoring',as_of='2026-10-18',sources=sources,valid_students=len(st),valid_grades=len(valid),raw_grades=len(data['Grades']),human_excel_review='pending; formulas and independent CSV cross-checks supplied, no claim of manual human calculation')
(BUILD/'reference.json').write_text(json.dumps(dict(sheets=sheets,cases=cases,manifest=manifest),ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'phase2/runs/khoa/reference-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
with (ROOT/'phase2/runs/khoa/test-cases.csv').open('w',newline='',encoding='utf-8') as f:
    w=csv.writer(f); w.writerow(['id','question','expected_tools','expected_values','note'])
    for c in cases:
        tools=';'.join('academic.'+x['tool'] if c['snapshot']=='main' else 'finance.'+x['tool'] for x in c['calls'])
        note=f"Source: {BASE[:7] if c['snapshot']=='main' else FINANCE[:7]}; Excel formulas in test-reference.xlsx; human review pending."
        if c['snapshot']!='main': note+=' Requires the complete PR #2 snapshot, including its HR/conduct CSVs; skip on main.'
        if c.get('manual_review'): note+=' '+c['manual_review']
        w.writerow([c['id'],c['question'],tools,json.dumps({'snapshot':c['snapshot'],'calls':c['calls']},ensure_ascii=False,separators=(',',':')),note])
print(json.dumps(dict(cases=len(cases),main_cases=sum(c['snapshot']=='main' for c in cases),excel_metrics=len(answers['values']),valid_grades=len(valid),source_files=len(sources))))

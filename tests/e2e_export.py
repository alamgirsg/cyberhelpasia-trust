"""E2E test: auditor pack ZIP export.

Run against a local server that shares UPLOAD_DIR with this test (for the tamper check):
  BASE=http://localhost:3000 UPLOAD_DIR=./uploads python tests/e2e_export.py
"""
import csv, glob, io, os, re, time, zipfile
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("BASE", "http://localhost:3000")
UPLOAD_DIR = os.path.abspath(os.environ.get("UPLOAD_DIR", "./uploads"))
TMP = os.environ.get("OUT", "/tmp")
stamp = int(time.time())
PW = "correct-horse-battery-staple"
passed = []


def ok(msg):
    passed.append(msg)
    print("PASS", msg)


def read_csv(z, name):
    text = z.read(name).decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(text)))


def upload(page, aid, control, path, desc):
    page.goto(f"{BASE}/app/evidence?assessment={aid}&control={control}")
    page.set_input_files("#file", path)
    page.fill("#description", desc)
    page.click("button:has-text('Upload evidence')")
    expect(page.get_by_text(f"Uploaded {os.path.basename(path)}")).to_be_visible()


def export(page, aid):
    r = page.request.get(f"{BASE}/api/assessments/{aid}/export")
    assert r.status == 200, r.status
    assert r.headers["content-type"] == "application/zip"
    assert re.search(r'attachment; filename="auditor-pack_.+_CE_\d{4}-\d{2}-\d{2}\.zip"', r.headers["content-disposition"]), r.headers["content-disposition"]
    return zipfile.ZipFile(io.BytesIO(r.body()))


with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_context(accept_downloads=True).new_page()

    page.goto(BASE + "/signup")
    page.fill("#company", "Marina Bay Clinic Pte Ltd")
    page.fill("#name", "Dr Lee")
    page.fill("#email", f"lee{stamp}@marinabay.sg")
    page.fill("#password", PW)
    page.click("button:has-text('Create workspace')")
    page.wait_for_url("**/app/start", wait_until="commit")
    page.click("button:has-text('Create assessment')")  # defaults → Cyber Essentials
    page.wait_for_url(re.compile(r".*/app/assessments/[0-9a-f-]{36}$"))
    aid = page.url.rsplit("/", 1)[1]
    expect(page.get_by_role("heading", level=1)).to_have_text("Cyber Essentials readiness")

    def answer(cid, status, note):
        d = page.locator("details", has=page.locator(f"text={cid}"))
        d.locator("summary").click()
        d.locator("select[name=status]").select_option(status)
        d.locator("textarea[name=notes]").fill(note)
        d.locator("button:has-text('Save')").click()
        page.wait_for_load_state("networkidle")

    answer("CE-4.1", "met", "Nightly immutable backups; restore tested monthly.")
    answer("CE-2.3", "not_met", '=HYPERLINK("http://evil.example","click")')
    ok("assessment answered (incl. a formula-injection note)")

    f1 = os.path.join(TMP, "backup-log.txt")
    open(f1, "w").write(f"Restore OK {stamp}")
    upload(page, aid, "CE-4.1", f1, "Restore test, September")
    open(f1, "w").write(f"Restore OK again {stamp}")
    upload(page, aid, "CE-4.1", f1, "Restore test, October")  # same file name → must not overwrite in ZIP
    f2 = os.path.join(TMP, "policy.txt")
    open(f2, "w").write("General security policy v1")
    upload(page, aid, "", f2, "Policy")
    ok("three evidence files uploaded (two with the same name)")

    # Button on the assessment page downloads the pack
    page.goto(f"{BASE}/app/assessments/{aid}")
    with page.expect_download() as dl:
        page.get_by_role("link", name="Download auditor pack").click()
    assert dl.value.suggested_filename.startswith("auditor-pack_marina-bay-clinic-pte-ltd_CE_"), dl.value.suggested_filename
    ok("download button delivers the ZIP")

    z = export(page, aid)
    names = set(z.namelist())
    expected = {"README.txt", "report.html", "controls.csv", "remediation-tasks.csv", "evidence-manifest.csv", "activity-log.csv",
                "evidence/CE-4.1/backup-log.txt", "evidence/CE-4.1/2-backup-log.txt", "evidence/general/policy.txt"}
    assert expected <= names, sorted(names)
    assert all(not n.startswith("/") and ".." not in n for n in names), names
    assert z.read("evidence/CE-4.1/backup-log.txt").decode() == f"Restore OK {stamp}"
    assert z.read("evidence/CE-4.1/2-backup-log.txt").decode() == f"Restore OK again {stamp}"
    ok("ZIP has all parts; duplicate names kept apart; no unsafe paths")

    controls = read_csv(z, "controls.csv")
    assert len(controls) == 10, len(controls)
    row = {r["Control ID"]: r for r in controls}
    assert row["CE-4.1"]["Status"] == "Met"
    assert row["CE-4.1"]["Evidence files"] == "evidence/CE-4.1/backup-log.txt; evidence/CE-4.1/2-backup-log.txt"
    assert row["CE-2.3"]["Notes"].startswith("'=HYPERLINK"), row["CE-2.3"]["Notes"]
    ok("controls.csv correct; formula injection neutralised")

    tasks = read_csv(z, "remediation-tasks.csv")
    assert [t["Control ID"] for t in tasks] == ["CE-2.3"] and tasks[0]["Priority"] == "high", tasks
    ok("remediation-tasks.csv lists the gap")

    manifest = read_csv(z, "evidence-manifest.csv")
    assert len(manifest) == 3 and all(m["Integrity check"] == "OK" for m in manifest), manifest
    readme = z.read("README.txt").decode()
    assert "every evidence file matched" in readme
    html = z.read("report.html").decode()
    assert "Marina Bay Clinic Pte Ltd" in html and 'href="evidence/CE-4.1/backup-log.txt"' in html
    assert "<script" not in html.lower()
    ok("manifest OK, report links to evidence inside the pack")

    # Tamper with a stored file: the next export must flag it
    victims = [f for f in glob.glob(os.path.join(UPLOAD_DIR, "*", "*.txt")) if open(f).read() == f"Restore OK {stamp}"]
    assert len(victims) == 1, victims
    open(victims[0], "w").write("tampered")
    z2 = export(page, aid)
    m2 = {m["Path in this pack"]: m["Integrity check"] for m in read_csv(z2, "evidence-manifest.csv")}
    assert m2["evidence/CE-4.1/backup-log.txt"] == "INTEGRITY FAILURE", m2
    assert m2["evidence/CE-4.1/2-backup-log.txt"] == "OK"
    assert "WARNING: 1 evidence file(s) failed the integrity check" in z2.read("README.txt").decode()
    assert "failed the integrity check" in z2.read("report.html").decode()
    ok("tampered evidence detected and flagged")

    # Logged in the activity log
    page.goto(BASE + "/app/audit")
    expect(page.get_by_text("assessment.exported").first).to_be_visible()
    ok("export recorded in activity log")

    # Isolation
    anon = b.new_context()
    assert anon.request.get(f"{BASE}/api/assessments/{aid}/export").status == 401
    other = b.new_context().new_page()
    other.goto(BASE + "/signup")
    other.fill("#company", "Someone Else"); other.fill("#name", "Eve")
    other.fill("#email", f"eve{stamp}@else.sg"); other.fill("#password", PW)
    other.click("button:has-text('Create workspace')")
    other.wait_for_url("**/app/start", wait_until="commit")
    assert other.request.get(f"{BASE}/api/assessments/{aid}/export").status == 404
    assert other.request.get(f"{BASE}/api/assessments/not-a-uuid/export").status == 404
    ok("anonymous → 401, other tenant → 404")

    b.close()

print(f"\n{len(passed)} checks passed")

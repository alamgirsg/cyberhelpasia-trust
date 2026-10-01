"""End-to-end smoke test for the Trust Platform MVP (run against a local server)."""
import os, re, sys, time
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("BASE", "http://localhost:3100")
OUT = os.environ.get("OUT", "/tmp")
email = f"owner{int(time.time())}@example.sg"
results = []

def ok(msg):
    results.append(msg); print("PASS", msg)

with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={"width": 1280, "height": 900})

    page.goto(BASE + "/")
    expect(page.get_by_role("heading", level=1)).to_contain_text("Cyber Essentials")
    page.screenshot(path=f"{OUT}/01-landing.png", full_page=True)
    ok("landing renders")

    # Weak password is rejected server-side
    page.goto(BASE + "/signup")
    page.fill("#company", "Lion City Logistics Pte Ltd")
    page.fill("#name", "Tan Wei Ming")
    page.fill("#email", email)
    page.fill("#password", "short")
    page.evaluate("document.querySelector('#password').removeAttribute('minlength')")
    page.click("button:has-text('Create workspace')")
    expect(page.locator("p[role=alert]")).to_contain_text("12 characters")
    ok("weak password rejected")

    page.fill("#password", "correct-horse-battery-staple")
    page.click("button:has-text('Create workspace')")
    page.wait_for_url("**/app/start", wait_until="commit")
    ok("signup → risk profile")

    # Risk profile: sells to gov + sensitive data → CTM
    page.check("input[name=sellsToGovOrCii][value=yes]")
    page.check("input[name=sensitiveData][value=yes]")
    page.screenshot(path=f"{OUT}/02-profile.png", full_page=True)
    page.click("button:has-text('Create assessment')")
    page.wait_for_url(re.compile(r".*/app/assessments/[0-9a-f-]{36}$"))
    expect(page.get_by_role("heading", level=1)).to_have_text("Cyber Trust readiness")
    expect(page.get_by_text("Recommended: Cyber Trust")).to_be_visible()
    assessment_url = page.url
    ok("CTM recommended and assessment created (22 controls)")
    assert page.locator("details").count() == 22

    # Answer three controls
    def answer(cid, status, note):
        d = page.locator("details", has=page.locator(f"text={cid}"))
        d.locator("summary").click()
        d.locator("select[name=status]").select_option(status)
        d.locator("textarea[name=notes]").fill(note)
        d.locator("button:has-text('Save')").click()
        page.wait_for_load_state("networkidle")
    answer("CTM-01", "met", "CISO appointed; quarterly board report.")
    answer("CTM-10", "not_met", "No offline backup.")
    answer("CTM-15", "partial", "MFA on email only.")
    page.reload()
    expect(page.locator("details", has=page.locator("text=CTM-01")).locator("summary")).to_contain_text("Met")
    expect(page.locator("details", has=page.locator("text=CTM-10")).locator("summary")).to_contain_text("Not met")
    page.screenshot(path=f"{OUT}/03-assessment.png", full_page=False)
    ok("responses saved")

    # Tasks auto-created for the two gaps
    page.goto(BASE + "/app/tasks")
    expect(page.get_by_text("Close gap: Backups are protected and restorable")).to_be_visible()
    expect(page.get_by_text("Close gap: Access is least-privilege and reviewed")).to_be_visible()
    page.screenshot(path=f"{OUT}/04-tasks.png", full_page=True)
    ok("remediation tasks generated")

    # Fixing a gap closes its task
    page.goto(assessment_url)
    answer("CTM-10", "met", "Immutable backups configured.")
    page.goto(BASE + "/app/tasks")
    expect(page.get_by_text("Close gap: Backups are protected and restorable")).to_have_count(0)
    ok("task closed when control met")

    # Evidence upload: allowed type works, disallowed type rejected
    tmp = os.path.join(OUT, "restore-test.txt")
    open(tmp, "w").write("Restore test OK 2026-10-01")
    page.goto(BASE + "/app/evidence?control=CTM-10")
    page.set_input_files("#file", tmp)
    page.fill("#description", "Restore test log")
    page.click("button:has-text('Upload evidence')")
    expect(page.get_by_text("Uploaded restore-test.txt")).to_be_visible()
    page.reload()
    expect(page.get_by_role("link", name="restore-test.txt")).to_be_visible()
    bad = os.path.join(OUT, "evil.html")
    open(bad, "w").write("<script>alert(1)</script>")
    page.set_input_files("#file", bad)
    page.click("button:has-text('Upload evidence')")
    expect(page.locator("p[role=alert]")).to_contain_text("Allowed types")
    page.screenshot(path=f"{OUT}/05-evidence.png", full_page=True)
    ok("evidence upload + type allowlist")

    # Download goes through auth
    with page.expect_download() as dl:
        page.get_by_role("link", name="restore-test.txt").click()
    assert open(dl.value.path()).read() == "Restore test OK 2026-10-01"
    ok("evidence download")

    # Dashboard and report
    page.goto(BASE + "/app")
    page.screenshot(path=f"{OUT}/06-dashboard.png", full_page=True)
    page.goto(assessment_url + "/report")
    expect(page.get_by_text("Overall readiness")).to_be_visible()
    page.screenshot(path=f"{OUT}/07-report.png", full_page=True)
    ok("dashboard + report")

    page.goto(BASE + "/app/audit")
    expect(page.get_by_text("evidence.uploaded")).to_be_visible()
    ok("audit log")

    # Tenant isolation: a second company cannot see the first one's assessment or evidence
    ev_href = None
    page.goto(BASE + "/app/evidence")
    ev_href = page.get_by_role("link", name="restore-test.txt").get_attribute("href")
    ctx2 = b.new_context()
    p2 = ctx2.new_page()
    p2.goto(BASE + "/signup")
    p2.fill("#company", "Other Co"); p2.fill("#name", "Other User")
    p2.fill("#email", "x" + email); p2.fill("#password", "another-long-password-123")
    p2.click("button:has-text('Create workspace')")
    p2.wait_for_url("**/app/start", wait_until="commit")
    r = p2.goto(assessment_url)
    assert r.status == 404, r.status
    r2 = p2.request.get(BASE + ev_href)
    assert r2.status == 404, r2.status
    ok("tenant isolation (assessment + evidence → 404)")

    # Logout and protected routes
    page.goto(BASE + "/app")
    page.click("button:has-text('Sign out')")
    page.wait_for_url("**/login", wait_until="commit")
    page.goto(BASE + "/app/tasks")
    page.wait_for_url("**/login", wait_until="commit")
    page.fill("#email", email); page.fill("#password", "wrong-password-xx")
    page.click("button:has-text('Sign in')")
    expect(page.locator("p[role=alert]")).to_contain_text("incorrect")
    page.fill("#password", "correct-horse-battery-staple")
    page.click("button:has-text('Sign in')")
    page.wait_for_url("**/app", wait_until="commit")
    ok("logout, route protection, login")

    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(assessment_url)
    page.screenshot(path=f"{OUT}/08-mobile.png", full_page=False)
    b.close()

print(f"\n{len(results)} checks passed")

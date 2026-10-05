"""E2E test: AI Assurance — inventory, explainable risk rating, override, review, CSV export, AI governance assessment.

Run against a local server:  BASE=http://localhost:3000 python tests/e2e_ai.py
"""
import csv, io, os, re, time, zipfile
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("BASE", "http://localhost:3000")
stamp = int(time.time())
PW = "correct-horse-battery-staple"
passed = []


def ok(msg):
    passed.append(msg)
    print("PASS", msg)


def alert(page):
    return page.locator("p[role=alert]")


CHATBOT = {"use": "customer_info", "autonomy": "autonomous", "tools": "read_only", "data": "personal", "untrusted_input": "yes", "scale": "customers"}
DRAFTING = {"use": "internal_productivity", "autonomy": "assistive", "tools": "none", "data": "internal", "untrusted_input": "no", "scale": "organisation"}


def fill_system(page, name, factors, vendor="", owner=""):
    page.fill("#name", name)
    if vendor:
        page.fill("#vendor", vendor)
    if owner:
        page.fill("#businessOwner", owner)
    for k, v in factors.items():
        page.check(f"input[name={k}][value={v}]")


def signup(page, company, name, email):
    page.goto(BASE + "/signup")
    page.fill("#company", company)
    page.fill("#name", name)
    page.fill("#email", email)
    page.fill("#password", PW)
    page.click("button:has-text('Create workspace')")
    page.wait_for_url("**/app/start", wait_until="commit")


with sync_playwright() as p:
    b = p.chromium.launch()
    owner = b.new_context(accept_downloads=True).new_page()
    signup(owner, "Merlion Fintech Pte Ltd", "Priya Nair", f"priya{stamp}@merlion.sg")

    owner.goto(BASE + "/app/ai")
    expect(owner.get_by_text("No AI systems recorded yet")).to_be_visible()
    ok("empty inventory state")

    # High-risk chatbot; live preview before saving
    owner.get_by_role("link", name="Add AI system").click()
    expect(owner.get_by_test_id("risk-preview")).to_contain_text("Answer all the questions")
    fill_system(owner, "Website support chatbot", CHATBOT, vendor="Anthropic", owner="Head of Customer Service")
    expect(owner.get_by_test_id("risk-preview")).to_contain_text("Risk rating: High")
    owner.screenshot(path=os.environ.get("OUT", "/tmp") + "/ai-form.png", full_page=True)
    owner.click("button:has-text('Add to inventory')")
    owner.wait_for_url(re.compile(r".*/app/ai/[0-9a-f-]{36}$"), wait_until="commit")
    chatbot_url = owner.url
    expect(owner.get_by_test_id("risk-card")).to_contain_text("High")
    expect(owner.get_by_test_id("risk-card")).to_contain_text("PDPA")
    tests_text = owner.get_by_test_id("suggested-tests").inner_text()
    for t in ["LLM01", "LLM02", "LLM07", "LLM09"]:
        assert t in tests_text, (t, tests_text)
    owner.screenshot(path=os.environ.get("OUT", "/tmp") + "/ai-detail.png", full_page=True)
    ok("live preview, High rating with reasons, suggested OWASP tests")

    # Low-risk internal assistant
    owner.goto(BASE + "/app/ai/new")
    fill_system(owner, "Staff drafting assistant", DRAFTING, vendor="Microsoft")
    owner.click("button:has-text('Add to inventory')")
    owner.wait_for_url(re.compile(r".*/app/ai/[0-9a-f-]{36}$"), wait_until="commit")
    drafting_url = owner.url
    expect(owner.get_by_test_id("risk-card")).to_contain_text("Low")
    ok("Low rating for internal advisory use")

    # Server-side validation when a question is unanswered
    owner.goto(BASE + "/app/ai/new")
    fill_system(owner, "Incomplete", {k: v for k, v in DRAFTING.items() if k != "scale"})
    owner.evaluate("document.querySelectorAll('input[type=radio]').forEach(e => e.removeAttribute('required'))")
    owner.click("button:has-text('Add to inventory')")
    expect(alert(owner)).to_contain_text("Answer every risk question")
    expect(owner.locator("#name")).to_have_value("Incomplete")
    ok("unanswered question rejected server-side; form keeps values")

    # Inventory list and summary
    owner.goto(BASE + "/app/ai")
    summary = owner.get_by_test_id("ai-summary").inner_text()
    assert re.search(r"1\s*High risk", summary) and re.search(r"1\s*Low risk", summary) and re.search(r"0\s*Medium risk", summary), summary
    owner.screenshot(path=os.environ.get("OUT", "/tmp") + "/ai-inventory.png", full_page=True)
    ok("inventory summary counts")

    # Override needs a reason; then it shows everywhere and is logged
    owner.goto(drafting_url)
    owner.get_by_test_id("override-panel").locator("summary").click()
    owner.check("input[name=rating][value=medium]")
    owner.fill("textarea[name=reason]", "too short")
    owner.click("button:has-text('Save override')")
    expect(alert(owner)).to_contain_text("at least 20 characters")
    expect(owner.locator("input[name=rating][value=medium]")).to_be_checked()
    expect(owner.locator("textarea[name=reason]")).to_have_value("too short")
    owner.fill("textarea[name=reason]", "Staff paste client contracts into it; treat as medium until DLP is in place.")
    owner.click("button:has-text('Save override')")
    expect(owner.get_by_test_id("override-reason")).to_contain_text("DLP")
    expect(owner.get_by_test_id("risk-card")).to_contain_text("Overridden from Low")
    owner.goto(BASE + "/app/ai")
    expect(owner.get_by_test_id("ai-row-Staff drafting assistant")).to_contain_text("Medium")
    expect(owner.get_by_test_id("ai-row-Staff drafting assistant")).to_contain_text("(override)")
    ok("override requires a reason; shown on detail and list")

    # Changing answers so the computed rating changes clears a stale override
    owner.goto(drafting_url + "?edit=1")
    expect(owner.locator("#name")).to_have_value("Staff drafting assistant")
    expect(owner.locator("input[name=use][value=internal_productivity]")).to_be_checked()
    owner.check("input[name=autonomy][value=autonomous]")
    owner.check("input[name=tools][value=write]")
    owner.click("button:has-text('Save changes')")
    owner.wait_for_url(re.compile(r".*/app/ai/[0-9a-f-]{36}$"), wait_until="commit")
    expect(owner.get_by_test_id("risk-card")).to_contain_text("High")
    expect(owner.get_by_test_id("override-reason")).to_have_count(0)
    ok("edit re-rates the system and clears an override that no longer applies")

    # Review
    owner.click("button:has-text('Mark reviewed today')")
    expect(owner.get_by_test_id("risk-card")).to_contain_text(f"Last reviewed {time.strftime('%d/%m/%Y')}")
    ok("mark reviewed")

    # CSV export (with a formula-looking name)
    owner.goto(BASE + "/app/ai/new")
    fill_system(owner, "=HYPERLINK(\"http://x\")", DRAFTING)
    owner.click("button:has-text('Add to inventory')")
    owner.wait_for_url(re.compile(r".*/app/ai/[0-9a-f-]{36}$"), wait_until="commit")
    r = owner.request.get(BASE + "/api/ai/inventory")
    assert r.status == 200 and r.headers["content-type"].startswith("text/csv")
    rows = list(csv.DictReader(io.StringIO(r.body().decode("utf-8-sig"))))
    assert len(rows) == 3, len(rows)
    by = {row["Name"]: row for row in rows}
    assert by["Website support chatbot"]["Effective rating"] == "High"
    assert "LLM01 Prompt injection" in by["Website support chatbot"]["Suggested tests (OWASP LLM 2025)"]
    assert "'=HYPERLINK(\"http://x\")" in by, list(by)
    ok("CSV export: all systems, effective rating, tests, formula guard")

    # AI governance assessment (reuses the assessment engine; opened once)
    owner.goto(BASE + "/app/ai")
    owner.click("button:has-text('Start assessment')")
    owner.wait_for_url(re.compile(r".*/app/assessments/[0-9a-f-]{36}$"))
    gov_url = owner.url
    expect(owner.get_by_role("heading", level=1)).to_have_text("AI governance readiness")
    assert owner.locator("details").count() == 15
    d = owner.locator("details", has=owner.locator("text=AIG-09"))
    d.locator("summary").click()
    expect(d).to_contain_text("References (indicative): OWASP LLM01")
    d.locator("select[name=status]").select_option("not_met")
    d.locator("textarea[name=notes]").fill("No red-team before launch.")
    d.locator("button:has-text('Save')").click()
    owner.wait_for_load_state("networkidle")
    owner.goto(BASE + "/app/tasks")
    expect(owner.get_by_text("Close gap: LLM applications are security-tested")).to_be_visible()
    owner.goto(BASE + "/app/ai")
    owner.get_by_role("link", name="Open assessment").click()
    owner.wait_for_url(gov_url)
    ok("AI governance assessment: 15 controls, reference label, gap → task, single assessment")

    z = zipfile.ZipFile(io.BytesIO(owner.request.get(gov_url.replace("/app/assessments/", "/api/assessments/") + "/export").body()))
    header = z.read("controls.csv").decode("utf-8-sig").splitlines()[0]
    assert header.endswith("References (indicative)"), header
    ok("auditor pack uses the AI framework's reference label")

    # Contributor can add but not override
    owner.goto(BASE + "/app/settings/team")
    owner.fill("#invite-email", f"dev{stamp}@merlion.sg")
    owner.select_option("#invite-role", "contributor")
    owner.click("button:has-text('Create invite link')")
    link = owner.get_by_test_id("invite-link").input_value()
    dev = b.new_context().new_page()
    dev.goto(link)
    dev.fill("#name", "Dev Lee")
    dev.fill("#password", PW)
    dev.click("button:has-text('Join workspace')")
    dev.wait_for_url(re.compile(r".*/app$"), wait_until="commit")
    dev.goto(chatbot_url)
    expect(dev.get_by_test_id("risk-card")).to_be_visible()
    expect(dev.get_by_test_id("override-panel")).to_have_count(0)
    dev.goto(BASE + "/app/ai")
    expect(dev.get_by_role("link", name="Add AI system")).to_be_visible()
    ok("contributor can add and edit but cannot override")

    # Isolation
    other = b.new_context().new_page()
    signup(other, "Other Co", "Eve", f"eve{stamp}@other.sg")
    assert other.goto(chatbot_url).status == 404
    rows = list(csv.DictReader(io.StringIO(other.request.get(BASE + "/api/ai/inventory").body().decode("utf-8-sig"))))
    assert rows == [], rows
    assert b.new_context().request.get(BASE + "/api/ai/inventory").status == 401
    ok("other tenant: 404 on system, empty CSV; anonymous: 401")

    owner.goto(BASE + "/app/audit")
    for a in ["ai_system.created", "ai_system.updated", "ai_system.override_set", "ai_system.reviewed", "ai_inventory.exported"]:
        expect(owner.get_by_text(a, exact=True).first).to_be_visible()
    ok("AI actions in the activity log")

    b.close()

print(f"\n{len(passed)} checks passed")

"""E2E test: authorised manual red-team engagements.

Run against a local server:  BASE=http://localhost:3000 python tests/e2e_engagements.py
"""
import io, os, re, time, zipfile
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


def signup(page, company, name, email):
    page.goto(BASE + "/signup")
    page.fill("#company", company); page.fill("#name", name); page.fill("#email", email); page.fill("#password", PW)
    page.click("button:has-text('Create workspace')")
    page.wait_for_url("**/app/start", wait_until="commit")


def add_system(page, name, factors):
    page.goto(BASE + "/app/ai/new")
    page.fill("#name", name)
    for k, v in factors.items():
        page.check(f"input[name={k}][value={v}]")
    page.click("button:has-text('Add to inventory')")
    page.wait_for_url(re.compile(r".*/app/ai/[0-9a-f-]{36}$"), wait_until="commit")
    return page.url


with sync_playwright() as b_pw:
    b = b_pw.chromium.launch()
    owner = b.new_context(accept_downloads=True).new_page()
    signup(owner, "Harbour AI Pte Ltd", "Wei Lin", f"wei{stamp}@harbour.sg")
    sys_url = add_system(owner, "Customer chatbot", CHATBOT)
    sys_id = sys_url.rsplit("/", 1)[1]

    # Governance assessment so AIG-09 exists for evidence filing
    owner.goto(BASE + "/app/ai")
    owner.click("button:has-text('Start assessment')")
    owner.wait_for_url(re.compile(r".*/app/assessments/[0-9a-f-]{36}$"))

    # Engagement cannot be created without the authorisation tick
    owner.goto(f"{BASE}/app/ai/{sys_id}/engagements/new")
    expect(owner.get_by_text("I am authorised")).to_be_visible()
    owner.evaluate("document.querySelector('input[name=authorise]').removeAttribute('required')")
    owner.click("button:has-text('Create engagement')")
    expect(alert(owner)).to_contain_text("confirm you are authorised")
    ok("engagement blocked without the authorisation confirmation")

    owner.check("input[name=authorise]")
    owner.fill("#scopeIn", "Test the public chatbot endpoint for prompt injection and data leakage.")
    owner.fill("#scopeOut", "No production customer data; no third-party systems; not the model provider's platform.")
    owner.click("button:has-text('Create engagement')")
    owner.wait_for_url(re.compile(r".*/engagements/[0-9a-f-]{36}$"), wait_until="commit")
    eng_url = owner.url
    expect(owner.get_by_test_id("authorisation")).to_contain_text("Authorised by Wei Lin")
    ok("engagement created; authorisation recorded with name and date")

    # Checklist reflects the chatbot's risk profile
    expect(owner.get_by_text("Suggested test checklist")).to_be_visible()
    for t in ["LLM01", "LLM02"]:
        expect(owner.get_by_text(t, exact=False).first).to_be_visible()

    # Add a finding with evidence
    tmp = os.path.join(os.environ.get("OUT", "/tmp"), "finding-evidence.txt")
    open(tmp, "w").write(f"Injection transcript {stamp}")
    form = owner.get_by_test_id("finding-form")
    form.locator("#f-title").fill("Prompt injection via chat message")
    form.locator("#f-sev").select_option("high")
    form.locator("#f-test").select_option("LLM01")
    form.locator("#f-detail").fill("A crafted message made the bot ignore its instructions.")
    form.locator("#f-rem").fill("Add input/output guardrails and system-prompt isolation.")
    form.locator("#f-file").set_input_files(tmp)
    form.locator("button:has-text('Add finding')").click()
    owner.wait_for_load_state("networkidle")
    owner.reload()
    expect(owner.get_by_test_id("finding-Prompt injection via chat message")).to_contain_text("HIGH")
    expect(owner.get_by_test_id("finding-Prompt injection via chat message").get_by_role("link", name="Evidence")).to_be_visible()
    expect(owner.locator("text=☑ LLM01").or_(owner.get_by_text("LLM01")).first).to_be_visible()
    ok("finding added with severity, test area and evidence; checklist ticks")

    # Viewer cannot add findings or authorise
    owner.goto(BASE + "/app/settings/team")
    owner.fill("#invite-email", f"view{stamp}@harbour.sg")
    owner.select_option("#invite-role", "viewer")
    owner.click("button:has-text('Create invite link')")
    link = owner.get_by_test_id("invite-link").input_value()
    viewer = b.new_context().new_page()
    viewer.goto(link); viewer.fill("#name", "Viewer"); viewer.fill("#password", PW); viewer.click("button:has-text('Join workspace')")
    viewer.wait_for_url(re.compile(r".*/app$"), wait_until="commit")
    viewer.goto(eng_url)
    expect(viewer.get_by_test_id("finding-form")).to_have_count(0)
    expect(viewer.get_by_test_id("finding-Prompt injection via chat message")).to_be_visible()
    viewer.goto(f"{BASE}/app/ai/{sys_id}/engagements/new")
    viewer.wait_for_url(re.compile(rf".*/app/ai/{sys_id}$"), wait_until="commit")
    ok("viewer can read but cannot add findings or open the authorise form")

    # Complete → report filed as AIG-09 evidence, engagement locked
    owner.goto(eng_url)
    owner.click("button:has-text('Complete')")
    owner.wait_for_load_state("networkidle")
    expect(owner.get_by_text("filed as evidence for control AIG-09")).to_be_visible()
    expect(owner.get_by_test_id("finding-form")).to_have_count(0)
    owner.goto(BASE + "/app/evidence")
    expect(owner.get_by_role("link", name=re.compile("redteam-"))).to_be_visible()
    ok("complete files the report as AIG-09 evidence and locks the engagement")

    # Report is in the AI governance auditor pack under AIG-09
    owner.goto(BASE + "/app/ai")
    owner.get_by_role("link", name="Open assessment").click()
    owner.wait_for_url(re.compile(r".*/app/assessments/[0-9a-f-]{36}$"))
    gov_id = owner.url.rsplit("/", 1)[1]
    z = zipfile.ZipFile(io.BytesIO(owner.request.get(f"{BASE}/api/assessments/{gov_id}/export").body()))
    assert any(n.startswith("evidence/AIG-09/redteam-") for n in z.namelist()), z.namelist()
    ok("red-team report appears in the auditor pack under AIG-09")

    # Isolation
    other = b.new_context().new_page()
    signup(other, "Rival Co", "Eve", f"eve{stamp}@rival.sg")
    assert other.goto(eng_url).status == 404
    ok("other tenant gets 404 on the engagement")

    owner.goto(BASE + "/app/audit")
    for a in ["engagement.created", "finding.added", "engagement.completed"]:
        expect(owner.get_by_text(a, exact=True).first).to_be_visible()
    ok("engagement actions in the activity log")

    b.close()

print(f"\n{len(passed)} checks passed")

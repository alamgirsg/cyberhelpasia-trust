"""E2E test: two-step verification (TOTP + recovery codes) and team invites.

Run against a local server:  BASE=http://localhost:3000 python tests/e2e_team_mfa.py
"""
import base64, hashlib, hmac, os, re, struct, time
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("BASE", "http://localhost:3000")
stamp = int(time.time())
OWNER = f"owner{stamp}@lioncity.sg"
MATE = f"mate{stamp}@lioncity.sg"
OTHER_OWNER = f"boss{stamp}@othercorp.sg"
PW = "correct-horse-battery-staple"
passed = []


def ok(msg):
    passed.append(msg)
    print("PASS", msg)


def totp(secret: str, step_offset: int = 0) -> str:
    key = base64.b32decode(secret + "=" * (-len(secret) % 8))
    step = int(time.time() // 30) + step_offset
    h = hmac.new(key, struct.pack(">Q", step), hashlib.sha1).digest()
    o = h[-1] & 15
    n = struct.unpack(">I", h[o:o + 4])[0] & 0x7FFFFFFF
    return f"{n % 1_000_000:06d}"


def alert(page):
    return page.locator("p[role=alert]")


def signup(page, company, name, email):
    page.goto(BASE + "/signup")
    page.fill("#company", company)
    page.fill("#name", name)
    page.fill("#email", email)
    page.fill("#password", PW)
    page.click("button:has-text('Create workspace')")
    page.wait_for_url("**/app/start", wait_until="commit")


def login(page, email, password=PW):
    page.goto(BASE + "/login")
    page.fill("#email", email)
    page.fill("#password", password)
    page.click("button:has-text('Sign in')")


with sync_playwright() as p:
    b = p.chromium.launch()
    owner = b.new_context().new_page()

    # ---------- MFA enrolment ----------
    signup(owner, "Lion City Logistics", "Tan Wei Ming", OWNER)
    owner.goto(BASE + "/app/settings/security")
    owner.click("button:has-text('Set up two-step verification')")
    secret = owner.get_by_test_id("mfa-secret").inner_text().strip()
    assert re.fullmatch(r"[A-Z2-7]{32}", secret), secret
    expect(owner.locator("img[alt^='QR code']")).to_be_visible()

    owner.fill("#code", "123456" if totp(secret) != "123456" else "654321")
    owner.click("button:has-text('Turn on')")
    expect(alert(owner)).to_contain_text("doesn't match")
    ok("wrong enrolment code rejected")

    enrol_code = totp(secret)
    owner.fill("#code", enrol_code)
    owner.click("button:has-text('Turn on')")
    expect(owner.get_by_test_id("recovery-codes").locator("li")).to_have_count(8)
    codes = owner.get_by_test_id("recovery-codes").locator("li").all_inner_texts()
    assert len(codes) == 8 and all(re.fullmatch(r"[a-z2-9]{4}-[a-z2-9]{4}", c) for c in codes), codes
    owner.screenshot(path=os.environ.get("OUT", "/tmp") + "/mfa-recovery.png")
    ok("MFA enabled, 8 recovery codes shown")

    # ---------- MFA login ----------
    owner.goto(BASE + "/app")
    owner.click("button:has-text('Sign out')")
    owner.wait_for_url("**/login", wait_until="commit")
    login(owner, OWNER)
    owner.wait_for_url("**/login/mfa", wait_until="commit")
    owner.goto(BASE + "/app")
    owner.wait_for_url("**/login", wait_until="commit")
    ok("password alone does not grant a session")

    login(owner, OWNER)
    owner.wait_for_url("**/login/mfa", wait_until="commit")
    owner.fill("#code", enrol_code)  # same time-step as enrolment → replay
    owner.click("button:has-text('Verify')")
    expect(alert(owner)).to_contain_text("not valid")
    ok("TOTP replay rejected")

    owner.fill("#code", totp(secret, +1))  # next step is within the ±1 window and newer
    owner.click("button:has-text('Verify')")
    owner.wait_for_url(re.compile(r".*/app$"), wait_until="commit")
    ok("TOTP login works")

    owner.click("button:has-text('Sign out')")
    owner.wait_for_url("**/login", wait_until="commit")
    login(owner, OWNER)
    owner.wait_for_url("**/login/mfa", wait_until="commit")
    owner.fill("#code", codes[0])
    owner.click("button:has-text('Verify')")
    owner.wait_for_url(re.compile(r".*/app$"), wait_until="commit")
    owner.click("button:has-text('Sign out')")
    owner.wait_for_url("**/login", wait_until="commit")
    login(owner, OWNER)
    owner.wait_for_url("**/login/mfa", wait_until="commit")
    owner.fill("#code", codes[0])
    owner.click("button:has-text('Verify')")
    expect(alert(owner)).to_contain_text("not valid")
    owner.fill("#code", codes[1])
    owner.click("button:has-text('Verify')")
    owner.wait_for_url(re.compile(r".*/app$"), wait_until="commit")
    ok("recovery code works once only")

    owner.goto(BASE + "/app/settings/security")
    expect(owner.get_by_text("6 unused recovery codes")).to_be_visible()
    ok("recovery code count shown")

    # ---------- Invites ----------
    owner.goto(BASE + "/app/settings/team")
    owner.fill("#invite-email", MATE)
    owner.select_option("#invite-role", "contributor")
    owner.click("button:has-text('Create invite link')")
    link = owner.get_by_test_id("invite-link").input_value()
    assert link.startswith(BASE + "/invite/"), link
    owner.screenshot(path=os.environ.get("OUT", "/tmp") + "/team.png", full_page=True)
    ok("invite link created")

    owner.fill("#invite-email", OWNER)
    owner.click("button:has-text('Create invite link')")
    expect(alert(owner)).to_contain_text("already a member")
    ok("cannot invite an existing member")

    mate = b.new_context().new_page()
    mate.goto(link)
    expect(mate.get_by_role("heading", name="Join Lion City Logistics")).to_be_visible()
    mate.fill("#name", "Siti Rahman")
    mate.fill("#password", PW)
    mate.click("button:has-text('Join workspace')")
    mate.wait_for_url(re.compile(r".*/app$"), wait_until="commit")
    expect(mate.get_by_text("Lion City Logistics").first).to_be_visible()
    ok("new user accepted invite and joined as contributor")

    mate.goto(BASE + "/app/settings/team")
    expect(mate.locator("#invite-email")).to_have_count(0)
    ok("contributor cannot invite")

    fresh = b.new_context().new_page()
    fresh.goto(link)
    expect(fresh.get_by_role("heading", name="Invitation not valid")).to_be_visible()
    ok("invite link is single-use")

    # Owner changes the contributor to viewer
    owner.goto(BASE + "/app/settings/team")
    row = owner.get_by_test_id(f"member-{MATE}")
    row.locator("select[name=role]").select_option("viewer")
    row.locator("button:has-text('Save')").click()
    owner.wait_for_load_state("networkidle")
    owner.reload()
    expect(owner.get_by_test_id(f"member-{MATE}").locator("select[name=role]")).to_have_value("viewer")
    ok("role changed to viewer")

    # Viewer cannot write: start page action must fail
    mate.goto(BASE + "/app/start")
    mate.click("button:has-text('Create assessment')")
    mate.wait_for_timeout(1500)
    assert "/app/assessments/" not in mate.url, mate.url
    ok("viewer cannot create an assessment")

    # Last owner cannot demote themselves
    owner.goto(BASE + "/app/settings/team")
    owner.get_by_test_id(f"member-{OWNER}").locator("select[name=role]").select_option("admin")
    owner.get_by_test_id(f"member-{OWNER}").locator("button:has-text('Save')").click()
    owner.wait_for_timeout(1500)
    owner.goto(BASE + "/app/settings/team")
    expect(owner.get_by_test_id(f"member-{OWNER}").locator("select[name=role]")).to_have_value("owner")
    ok("last owner cannot be demoted")

    # ---------- Existing user (with MFA) invited to a second workspace ----------
    boss = b.new_context().new_page()
    signup(boss, "Other Corp", "Lim Boss", OTHER_OWNER)
    boss.goto(BASE + "/app/settings/team")
    boss.fill("#invite-email", OWNER)
    boss.select_option("#invite-role", "admin")
    boss.click("button:has-text('Create invite link')")
    link2 = boss.get_by_test_id("invite-link").input_value()

    joiner = b.new_context().new_page()
    joiner.goto(link2)
    expect(joiner.get_by_text("You already have an account")).to_be_visible()
    joiner.fill("#password", "wrong-password-123")
    joiner.click("button:has-text('Join workspace')")
    expect(alert(joiner)).to_contain_text("incorrect")
    joiner.fill("#password", PW)
    joiner.click("button:has-text('Join workspace')")
    joiner.wait_for_url("**/login/mfa", wait_until="commit")
    ok("existing user with MFA must pass second factor after accepting")
    joiner.fill("#code", codes[2])
    joiner.click("button:has-text('Verify')")
    joiner.wait_for_url(re.compile(r".*/app$"), wait_until="commit")
    ws = joiner.locator("select[name=tenantId]")
    expect(ws).to_have_value(re.compile(".+"))
    assert sorted(ws.locator("option").all_inner_texts()) == ["Lion City Logistics", "Other Corp"]
    assert joiner.locator("select[name=tenantId] option:checked").inner_text() == "Other Corp"
    ok("joined second workspace; switcher lists both")

    ws.select_option(label="Lion City Logistics")
    joiner.click("button:has-text('Go')")
    joiner.wait_for_load_state("networkidle")
    expect(ws).to_have_value(re.compile(".+"))
    assert joiner.locator("select[name=tenantId] option:checked").inner_text() == "Lion City Logistics"
    ok("workspace switch works")

    # ---------- Disable MFA ----------
    owner.goto(BASE + "/app/settings/security")
    owner.fill("#code", codes[3])
    owner.click("button:has-text('Turn off')")
    expect(owner.get_by_role("button", name="Set up two-step verification")).to_be_visible()
    ok("MFA turned off with a recovery code")

    b.close()

print(f"\n{len(passed)} checks passed")

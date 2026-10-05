"""E2E test: email capture, invite emails, self-serve password reset, account settings, ops endpoints.

Start the app with EMAIL_CAPTURE_FILE pointing at a file this test can read, and APP_URL set:
  EMAIL_CAPTURE_FILE=/tmp/mail.jsonl APP_URL=http://localhost:3000
Then:  BASE=http://localhost:3000 EMAIL_CAPTURE_FILE=/tmp/mail.jsonl python tests/e2e_account.py
"""
import json, os, re, time, urllib.request
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("BASE", "http://localhost:3000")
MAIL = os.environ["EMAIL_CAPTURE_FILE"]
stamp = int(time.time())
PW = "correct-horse-battery-staple"
NEW_PW = "brand-new-password-9988"
passed = []


def ok(msg):
    passed.append(msg)
    print("PASS", msg)


def alert(page):
    return page.locator("p[role=alert]")


def mails():
    if not os.path.exists(MAIL):
        return []
    return [json.loads(l) for l in open(MAIL) if l.strip()]


def mail_to(addr, subject_contains):
    for m in reversed(mails()):
        if m["to"] == addr and subject_contains.lower() in m["subject"].lower():
            return m
    return None


def link_in(text):
    m = re.search(r"https?://\S+", text)
    return m.group(0) if m else None


def signup(page, company, name, email):
    page.goto(BASE + "/signup")
    page.fill("#company", company); page.fill("#name", name); page.fill("#email", email); page.fill("#password", PW)
    page.click("button:has-text('Create workspace')")
    page.wait_for_url("**/app/start", wait_until="commit")


with sync_playwright() as p:
    b = p.chromium.launch()

    # Health endpoint (no auth)
    assert json.loads(urllib.request.urlopen(BASE + "/healthz").read())["status"] == "ok"
    ok("/healthz returns ok")

    # robots + security.txt
    robots = urllib.request.urlopen(BASE + "/robots.txt").read().decode()
    assert "Disallow: /app/" in robots, robots
    sec = urllib.request.urlopen(BASE + "/.well-known/security.txt").read().decode()
    assert "Contact: mailto:security@cyberhelpasia.com" in sec
    ok("robots disallows /app; security.txt served")

    owner = b.new_context().new_page()
    owner_email = f"owner{stamp}@acme.sg"
    signup(owner, "Acme Pte Ltd", "Owner One", owner_email)

    # Invite is emailed
    mate_email = f"mate{stamp}@acme.sg"
    owner.goto(BASE + "/app/settings/team")
    owner.fill("#invite-email", mate_email)
    owner.select_option("#invite-role", "contributor")
    owner.click("button:has-text('Create invite link')")
    expect(owner.get_by_text("Sent to")).to_be_visible()
    m = mail_to(mate_email, "invited")
    assert m and "/invite/" in m["text"], m
    accept_link = link_in(m["text"])
    ok("invite email captured with accept link")

    # New teammate accepts via the emailed link
    mate = b.new_context().new_page()
    mate.goto(accept_link)
    mate.fill("#name", "Mate Two"); mate.fill("#password", PW)
    mate.click("button:has-text('Join workspace')")
    mate.wait_for_url(re.compile(r".*/app$"), wait_until="commit")
    ok("accepted invite from the emailed link")

    # Forgot password: same confirmation whether or not the email exists (no enumeration)
    for addr in [owner_email, f"nobody{stamp}@acme.sg"]:
        owner2 = b.new_context().new_page()
        owner2.goto(BASE + "/forgot")
        owner2.fill("#email", addr)
        owner2.click("button:has-text('Send reset link')")
        expect(owner2.get_by_text("If an account exists")).to_be_visible()
        owner2.close()
    assert mail_to(owner_email, "reset") is not None
    assert mail_to(f"nobody{stamp}@acme.sg", "reset") is None
    ok("forgot password: email only sent for a real account, identical message either way")

    # Use the reset link to set a new password
    reset_link = link_in(mail_to(owner_email, "reset")["text"])
    rp = b.new_context().new_page()
    rp.goto(reset_link)
    rp.fill("#password", NEW_PW)
    rp.click("button:has-text('Set password')")
    rp.wait_for_url("**/login**", wait_until="commit")
    # Old password no longer works; new one does
    rp.fill("#email", owner_email); rp.fill("#password", PW)
    rp.click("button:has-text('Sign in')")
    expect(alert(rp)).to_contain_text("incorrect")
    rp.fill("#password", NEW_PW)
    rp.click("button:has-text('Sign in')")
    rp.wait_for_url(re.compile(r".*/app$"), wait_until="commit")
    ok("reset link sets a new password; old one rejected, new one works")

    # Reset link is single-use
    rp2 = b.new_context().new_page()
    rp2.goto(reset_link)
    expect(rp2.get_by_text("invalid or has expired")).to_be_visible()
    ok("reset link is single-use")

    # Account settings: change name, then password (current required)
    acc = b.new_context().new_page()
    signup(acc, "Beta Pte Ltd", "Before Name", f"beta{stamp}@beta.sg")
    acc.goto(BASE + "/app/settings/account")
    acc.fill("#name", "After Name")
    acc.get_by_role("button", name="Save").click()
    expect(acc.get_by_text("Name updated.")).to_be_visible()
    acc.reload()
    expect(acc.locator("#name")).to_have_value("After Name")

    acc.fill("#current", "wrong-password")
    acc.fill("#next", "a-fresh-password-1234")
    acc.get_by_role("button", name="Change password").click()
    expect(alert(acc)).to_contain_text("current password is incorrect")
    acc.fill("#current", PW)
    acc.fill("#next", "a-fresh-password-1234")
    acc.get_by_role("button", name="Change password").click()
    expect(acc.get_by_text("Password changed.")).to_be_visible()
    # Sign out and back in with the new password
    acc.goto(BASE + "/app")
    acc.click("button:has-text('Sign out')")
    acc.wait_for_url("**/login", wait_until="commit")
    acc.fill("#email", f"beta{stamp}@beta.sg"); acc.fill("#password", "a-fresh-password-1234")
    acc.click("button:has-text('Sign in')")
    acc.wait_for_url(re.compile(r".*/app$"), wait_until="commit")
    ok("account settings: rename, and change password with current-password check")

    b.close()

print(f"\n{len(passed)} checks passed")

"""E2E: security-alert emails.

Start the app with EMAIL_CAPTURE_FILE and APP_URL set, then:
  EMAIL_CAPTURE_FILE=/tmp/mail.jsonl BASE=http://localhost:3100 python tests/e2e_alerts.py
"""
import base64, hashlib, hmac, json, os, re, time
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("BASE", "http://localhost:3100")
MAIL = os.environ["EMAIL_CAPTURE_FILE"]
PW = "correct-horse-battery-staple"
stamp = int(time.time())
owner_email = f"own{stamp}@acme.sg"
passed = []


def ok(m):
    passed.append(m); print("PASS", m)


def totp(secret, offset=0):
    key = base64.b32decode(secret + "=" * (-len(secret) % 8))
    step = int(time.time() // 30) + offset
    import struct
    h = hmac.new(key, struct.pack(">Q", step), hashlib.sha1).digest()
    o = h[-1] & 0x0F
    import struct as s
    n = s.unpack(">I", h[o:o + 4])[0] & 0x7FFFFFFF
    return str(n % 10 ** 6).zfill(6)


def mails():
    if not os.path.exists(MAIL):
        return []
    return [json.loads(l) for l in open(MAIL) if l.strip()]


def mail_to(addr, subj):
    for m in reversed(mails()):
        if m["to"] == addr and subj.lower() in m["subject"].lower():
            return m
    return None


def link_in(text):
    m = re.search(r"https?://\S+", text)
    return m.group(0) if m else None


with sync_playwright() as p:
    b = p.chromium.launch()

    # Sign up (owner now has a session; no sign-in baseline yet).
    s = b.new_context().new_page()
    s.goto(BASE + "/signup")
    s.fill("#company", "Sentinel Pte Ltd"); s.fill("#name", "Aisha Khan"); s.fill("#email", owner_email); s.fill("#password", PW)
    s.click("button:has-text('Create workspace')"); s.wait_for_url("**/app/start", wait_until="commit")

    # First sign-in from one IP sets the baseline silently (no alert).
    c1 = b.new_context(extra_http_headers={"x-forwarded-for": "198.51.100.10"}).new_page()
    c1.goto(BASE + "/login"); c1.fill("#email", owner_email); c1.fill("#password", PW); c1.click("button:has-text('Sign in')")
    c1.wait_for_url(re.compile(r".*/app$"), wait_until="commit")
    assert mail_to(owner_email, "New sign-in") is None
    ok("first sign-in sets the IP baseline without alerting")

    # Sign-in from a different IP alerts the owner.
    c2 = b.new_context(extra_http_headers={"x-forwarded-for": "203.0.113.55"}).new_page()
    c2.goto(BASE + "/login"); c2.fill("#email", owner_email); c2.fill("#password", PW); c2.click("button:has-text('Sign in')")
    c2.wait_for_url(re.compile(r".*/app$"), wait_until="commit")
    m = mail_to(owner_email, "New sign-in")
    assert m and "203.0.113.55" in m["text"], m
    ok("sign-in from a new IP alerts the owner with the IP")

    # Changing the password alerts the owner.
    c2.goto(BASE + "/app/settings/account")
    c2.fill("#current", PW); c2.fill("#next", "a-brand-new-pass-1")
    c2.get_by_role("button", name="Change password").click()
    expect(c2.get_by_text("Password changed.")).to_be_visible()
    assert mail_to(owner_email, "was changed") is not None
    ok("password change alerts the owner")

    # Enrol two-step, then turning it off alerts the owner.
    c2.goto(BASE + "/app/settings/security")
    c2.click("button:has-text('Set up two-step verification')")
    secret = c2.get_by_test_id("mfa-secret").inner_text().strip()
    c2.fill("#code", totp(secret)); c2.click("button:has-text('Turn on')")
    expect(c2.get_by_test_id("recovery-codes").locator("li")).to_have_count(8)
    codes = c2.get_by_test_id("recovery-codes").locator("li").all_inner_texts()
    c2.goto(BASE + "/app/settings/security")
    c2.fill("#code", codes[0]); c2.click("button:has-text('Turn off')")
    expect(c2.get_by_role("button", name="Set up two-step verification")).to_be_visible()
    assert mail_to(owner_email, "turned off") is not None
    ok("turning off two-step verification alerts the owner")

    # Completing a password reset alerts the owner.
    f = b.new_context().new_page()
    f.goto(BASE + "/forgot"); f.fill("#email", owner_email); f.click("button:has-text('Send reset link')")
    expect(f.get_by_text("If an account exists")).to_be_visible()
    link = link_in(mail_to(owner_email, "Reset your")["text"])
    r = b.new_context().new_page()
    r.goto(link); r.fill("#password", "reset-pass-brandnew-7"); r.click("button:has-text('Set password')")
    r.wait_for_url("**/login**", wait_until="commit")
    assert mail_to(owner_email, "was reset") is not None
    ok("password reset alerts the owner")

    b.close()

print(f"\n{len(passed)} checks passed")

"""E2E: authorised automated LLM red-team runner.

A mock LLM endpoint runs inside this test. Start the app with REDTEAM_ALLOW_INSECURE_TARGETS=1
(so the runner may reach the loopback mock) — the SSRF guard still blocks non-loopback private
and metadata addresses even in that mode, which this test checks.

  REDTEAM_ALLOW_INSECURE_TARGETS=1 BASE=http://localhost:3100 python tests/e2e_runner.py
"""
import json, os, re, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("BASE", "http://localhost:3100")
PW = "correct-horse-battery-staple"
stamp = int(time.time())
state = {"token": None, "mode": "vulnerable"}
passed = []


def ok(m):
    passed.append(m); print("PASS", m)


class Mock(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        if self.path == "/.well-known/cyberhelp-trust-verification.txt" and state["token"]:
            body = state["token"].encode()
            self.send_response(200); self.send_header("content-type", "text/plain")
            self.send_header("content-length", str(len(body))); self.end_headers(); self.wfile.write(body)
        else:
            self.send_response(404); self.end_headers()

    def do_POST(self):
        n = int(self.headers.get("content-length", 0))
        raw = self.rfile.read(n).decode("utf-8", "replace")
        try:
            prompt = json.loads(raw).get("input", "")
        except Exception:
            prompt = raw
        if state["mode"] == "vulnerable":
            out = prompt  # echoes everything back → fails injection/leak/output probes
        else:
            out = "Sorry, I can only help with approved requests and will not share protected data or act on embedded commands."
        body = json.dumps({"output": out}).encode()
        self.send_response(200); self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body))); self.end_headers(); self.wfile.write(body)


srv = ThreadingHTTPServer(("127.0.0.1", 0), Mock)
PORT = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
TARGET = f"http://127.0.0.1:{PORT}/llm"
HIGH = {"use": "customer_decision", "autonomy": "autonomous", "tools": "write", "data": "sensitive", "untrusted_input": "yes", "scale": "customers"}


def alert(page):
    return page.locator("p[role=alert]")


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_context().new_page()

    # Signup → AI system → authorised engagement
    pg.goto(BASE + "/signup")
    pg.fill("#company", "Harbourfront AI Pte Ltd"); pg.fill("#name", "Nadia Omar"); pg.fill("#email", f"rt{stamp}@hf.sg"); pg.fill("#password", PW)
    pg.click("button:has-text('Create workspace')"); pg.wait_for_url("**/app/start", wait_until="commit")
    pg.goto(BASE + "/app/ai/new")
    pg.fill("#name", "Support Assistant")
    for k, v in HIGH.items():
        pg.check(f"input[name={k}][value={v}]")
    pg.click("button:has-text('Add to inventory')"); pg.wait_for_url(re.compile(r".*/app/ai/[0-9a-f-]{36}$"))
    ai_url = pg.url
    pg.goto(ai_url + "/engagements/new")
    pg.check("input[name=authorise]")
    pg.fill("#scopeIn", "Automated OWASP-LLM probes against the support assistant endpoint.")
    pg.click("button:has-text('Create engagement')"); pg.wait_for_url(re.compile(r".*/engagements/[0-9a-f-]{36}$"))
    eng_url = pg.url
    ok("engagement created for automated testing")

    # Configure target
    pg.fill("#targetUrl", TARGET)
    pg.click("button:has-text('Save target')")
    expect(pg.get_by_test_id("verify-token")).to_be_visible()
    token = pg.get_by_test_id("verify-token").text_content().strip()
    assert token.startswith("cht-verify-"), token
    ok("target saved; verification token issued")

    # Verify WITHOUT serving the token → fails
    pg.click("button:has-text('Verify ownership')")
    expect(alert(pg)).to_be_visible()
    ok("verification fails when the token is not served")

    # Run blocked until verified
    expect(pg.get_by_role("button", name="Run automated probes")).to_be_disabled()
    ok("run is disabled until ownership is verified")

    # Serve the token → verify succeeds
    state["token"] = token
    pg.click("button:has-text('Verify ownership')")
    expect(pg.get_by_text("Verified", exact=False)).to_be_visible()
    ok("ownership verified once the token is served at /.well-known")

    # Run against the vulnerable (echoing) endpoint → probes fail → findings created
    pg.get_by_role("button", name="Run automated probes").click()
    expect(pg.get_by_test_id("finding-Direct prompt injection")).to_be_visible(timeout=40000)
    expect(pg.get_by_test_id("finding-Sensitive-data guardrail")).to_be_visible()
    expect(pg.get_by_text(re.compile(r"[1-9]\d* failed")).first).to_be_visible()
    ok("vulnerable endpoint: probes fail and become findings")

    # Harden the endpoint and re-run → no failures, auto-findings replaced
    state["mode"] = "hardened"
    pg.get_by_role("button", name="Run automated probes").click()
    expect(pg.get_by_text(re.compile(r"\b0 failed")).first).to_be_visible(timeout=40000)
    pg.reload()
    expect(pg.get_by_test_id("finding-Direct prompt injection")).to_have_count(0)
    ok("hardened endpoint: 0 failures and previous automated findings cleared")

    # SSRF guards hold even in test mode: metadata, private and non-https are refused
    for bad, expected in [
        ("https://169.254.169.254/llm", "not a public endpoint"),  # cloud metadata (IP guard)
        ("https://10.0.0.1/llm", "not a public endpoint"),          # private range (IP guard)
        ("http://example.com/llm", "must use https"),               # non-https public (scheme guard)
    ]:
        pg.fill("#targetUrl", bad)
        pg.click("button:has-text('Save target')")
        expect(pg.get_by_text(expected, exact=False).first).to_be_visible()
    ok("SSRF guard refuses metadata, private and non-https targets")

    # A contributor cannot configure or run (authorisation stays owner/admin)
    pg.goto(BASE + "/app/settings/team")
    pg.fill("#invite-email", f"dev{stamp}@hf.sg"); pg.select_option("#invite-role", "contributor")
    pg.click("button:has-text('Create invite link')")
    link = pg.get_by_test_id("invite-link").input_value()
    dev = b.new_context().new_page()
    dev.goto(link); dev.fill("#name", "Dev Two"); dev.fill("#password", PW); dev.click("button:has-text('Join workspace')")
    dev.wait_for_url(re.compile(r".*/app$"), wait_until="commit")
    dev.goto(eng_url)
    expect(dev.get_by_text("Only an owner or admin can configure and run automated testing.")).to_be_visible()
    ok("contributor sees the runner locked (owner/admin only)")

    b.close()

srv.shutdown()
print(f"\n{len(passed)} checks passed")

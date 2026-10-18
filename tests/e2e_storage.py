"""E2E: S3-compatible evidence storage.

A mock S3 endpoint runs inside this test. Start the app pointed at it:
  STORAGE_DRIVER=s3 S3_BUCKET=evidence S3_ENDPOINT=http://127.0.0.1:<port> S3_FORCE_PATH_STYLE=true \
  S3_ACCESS_KEY_ID=test S3_SECRET_ACCESS_KEY=test S3_REGION=ap-southeast-1
The test prints the port to use; in practice the runner wires it up (see the shell harness).

  BASE=http://localhost:3100 S3_MOCK_PORT=<port> python tests/e2e_storage.py
"""
import io, os, re, threading, zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("BASE", "http://localhost:3100")
PORT = int(os.environ["S3_MOCK_PORT"])
PW = "correct-horse-battery-staple"
import time
stamp = int(time.time())
store = {}  # path -> bytes
passed = []


def ok(m):
    passed.append(m); print("PASS", m)


class S3Mock(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def key(self):
        return self.path.split("?")[0]  # S3 SDK appends ?x-id=...; key by path only

    def do_PUT(self):
        n = int(self.headers.get("content-length", 0))
        store[self.key()] = self.rfile.read(n)
        self.send_response(200); self.send_header("ETag", '"mock"'); self.end_headers()

    def do_GET(self):
        b = store.get(self.key())
        if b is None:
            self.send_response(404); self.end_headers(); self.wfile.write(b"<Error><Code>NoSuchKey</Code></Error>")
            return
        self.send_response(200); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)

    def do_HEAD(self):
        b = store.get(self.key())
        self.send_response(200 if b is not None else 404)
        if b is not None:
            self.send_header("content-length", str(len(b)))
        self.end_headers()


srv = ThreadingHTTPServer(("127.0.0.1", PORT), S3Mock)
threading.Thread(target=srv.serve_forever, daemon=True).start()

CONTENT = f"Backup restore verified OK {stamp}".encode()


def upload(page, aid, control, name, body):
    import tempfile
    p = os.path.join(tempfile.gettempdir(), name)
    open(p, "wb").write(body)
    page.goto(f"{BASE}/app/evidence?assessment={aid}&control={control}")
    page.set_input_files("#file", p)
    page.fill("#description", "Restore test log")
    page.click("button:has-text('Upload evidence')")
    expect(page.get_by_text(f"Uploaded {name}")).to_be_visible()


with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_context(accept_downloads=True).new_page()

    page.goto(BASE + "/signup")
    page.fill("#company", "Keppel Data Pte Ltd"); page.fill("#name", "Lim Wei"); page.fill("#email", f"st{stamp}@keppel.sg"); page.fill("#password", PW)
    page.click("button:has-text('Create workspace')"); page.wait_for_url("**/app/start", wait_until="commit")
    page.check("input[name=sellsToGovOrCii][value=yes]"); page.check("input[name=sensitiveData][value=yes]")
    page.click("button:has-text('Create assessment')"); page.wait_for_url(re.compile(r".*/app/assessments/[0-9a-f-]{36}$"))
    aid = page.url.rsplit("/", 1)[-1]

    # Upload evidence — it must land in the mock S3 bucket, not on local disk.
    assert not store
    upload(page, aid, "CTM-01", "restore-test.txt", CONTENT)
    keys = [k for k in store if k.endswith(".txt")]
    assert len(keys) == 1 and keys[0].startswith("/evidence/"), list(store)
    assert store[keys[0]] == CONTENT, "stored bytes differ from the uploaded file"
    ok("evidence upload writes the exact bytes to the S3 bucket")

    # The auditor pack reads evidence back from S3 and integrity-checks it.
    r = page.request.get(f"{BASE}/api/assessments/{aid}/export")
    assert r.status == 200, r.status
    z = zipfile.ZipFile(io.BytesIO(r.body()))
    ev_path = next(n for n in z.namelist() if n.startswith("evidence/CTM-01/") and n.endswith(".txt"))
    assert z.read(ev_path) == CONTENT
    assert "every evidence file matched" in z.read("README.txt").decode()
    ok("auditor pack reads evidence back from S3 with integrity verified")

    # Direct download also streams from S3.
    with page.expect_download() as dl:
        page.goto(f"{BASE}/app/evidence")
        page.get_by_role("link", name="restore-test.txt").click()
    data = open(dl.value.path(), "rb").read()
    assert data == CONTENT
    ok("evidence download streams the file back from S3")

    b.close()

srv.shutdown()
print(f"\n{len(passed)} checks passed")

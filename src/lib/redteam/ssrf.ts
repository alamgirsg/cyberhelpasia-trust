import "server-only";
import net from "node:net";
import dns from "node:dns";
import dnsp from "node:dns/promises";
import { Agent, request as undiciRequest } from "undici";

/**
 * Egress safety for the automated red-team runner.
 *
 * The runner must only ever reach a target the customer controls (proven by ownership
 * verification) and must never be usable to reach internal services (SSRF). These guards:
 *   - allow only https (http allowed only to loopback, and only in explicit test mode);
 *   - reject credentials embedded in the URL;
 *   - resolve the host and reject any private / loopback / link-local / metadata / reserved IP,
 *     re-checking at socket-connect time (closes the DNS-rebinding window);
 *   - refuse redirects (a 3xx is treated as an error, so a target cannot bounce us elsewhere);
 *   - cap time and response size.
 *
 * Test mode: REDTEAM_ALLOW_INSECURE_TARGETS=1 relaxes the host/scheme checks so the e2e
 * suite can point the runner at a local mock endpoint. It defaults OFF and must never be set
 * in production.
 */

export function insecureTargetsAllowed(): boolean {
  return process.env.REDTEAM_ALLOW_INSECURE_TARGETS === "1";
}

/** True for a public, routable address we are willing to connect to. */
export function isPublicAddress(ip: string): boolean {
  const kind = net.isIP(ip);
  if (kind === 4) return isPublicV4(ip);
  if (kind === 6) return isPublicV6(ip);
  return false;
}

/** Loopback only (127.0.0.0/8, ::1). */
export function isLoopback(ip: string): boolean {
  const kind = net.isIP(ip);
  if (kind === 4) return ip.split(".")[0] === "127";
  if (kind === 6) return ip.toLowerCase().split("%")[0] === "::1";
  return false;
}

/**
 * Whether we may connect to a resolved address. Public addresses are always allowed. Test mode
 * additionally allows LOOPBACK (for the e2e mock) — but never private, link-local or metadata
 * addresses, so the SSRF guards stay enforced even with insecure targets enabled.
 */
function addressAllowed(ip: string, insecure: boolean): boolean {
  return isPublicAddress(ip) || (insecure && isLoopback(ip));
}

function isPublicV4(ip: string): boolean {
  const p = ip.split(".").map((n) => parseInt(n, 10));
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;
  const [a, b] = p;
  if (a === 0) return false; // 0.0.0.0/8
  if (a === 10) return false; // private
  if (a === 127) return false; // loopback
  if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT 100.64/10
  if (a === 169 && b === 254) return false; // link-local + cloud metadata 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return false; // private
  if (a === 192 && b === 168) return false; // private
  if (a === 192 && b === 0) return false; // 192.0.0/24, 192.0.2/24 (test-net)
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmark
  if (a === 198 && b === 51) return false; // test-net-2 198.51.100/24
  if (a === 203 && b === 0) return false; // test-net-3 203.0.113/24
  if (a >= 224) return false; // multicast + reserved + 255.255.255.255
  return true;
}

function isPublicV6(ipRaw: string): boolean {
  const ip = ipRaw.toLowerCase().split("%")[0]; // strip zone id
  if (ip === "::1" || ip === "::") return false; // loopback / unspecified
  // IPv4-mapped / -embedded: ::ffff:1.2.3.4 or ::ffff:0:0/96 and 64:ff9b::/96 (NAT64)
  const mapped = ip.match(/(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPublicV4(mapped[1]);
  if (ip.startsWith("fe8") || ip.startsWith("fe9") || ip.startsWith("fea") || ip.startsWith("feb")) return false; // fe80::/10
  if (ip.startsWith("fc") || ip.startsWith("fd")) return false; // fc00::/7 unique-local
  if (ip.startsWith("ff")) return false; // multicast
  if (ip.startsWith("2001:db8")) return false; // documentation
  if (ip.startsWith("::ffff:")) return false; // mapped but non-dotted form
  return true;
}

export class TargetRejected extends Error {}

/** Validate scheme / credentials / host, returning the parsed URL. Throws TargetRejected. */
export async function assertSafeTarget(urlStr: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    throw new TargetRejected("That is not a valid URL.");
  }
  const insecure = insecureTargetsAllowed();
  if (url.username || url.password) throw new TargetRejected("The URL must not contain credentials.");
  if (url.protocol !== "https:") {
    const loopbackHttp = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");
    if (!(insecure && loopbackHttp)) throw new TargetRejected("The endpoint must use https://.");
  }

  // A literal IP in the URL is checked directly; a hostname is resolved and every address checked.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) {
    if (!addressAllowed(host, insecure)) throw new TargetRejected("That address is not a public endpoint.");
  } else if (host === "localhost") {
    if (!insecure) throw new TargetRejected("That address is not a public endpoint.");
  } else {
    let addrs: { address: string }[] = [];
    try {
      addrs = await dnsp.lookup(host, { all: true });
    } catch {
      throw new TargetRejected("The endpoint's host could not be resolved.");
    }
    if (!addrs.length) throw new TargetRejected("The endpoint's host could not be resolved.");
    if (!addrs.every((a) => addressAllowed(a.address, insecure)))
      throw new TargetRejected("The endpoint resolves to a non-public address.");
  }
  return url;
}

/** A dispatcher whose socket-connect re-checks the resolved IP, closing the rebinding window. */
function guardedAgent(): Agent {
  const insecure = insecureTargetsAllowed();
  return new Agent({
    connect: {
      lookup(
        hostname: string,
        options: dns.LookupOptions,
        cb: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family: number) => void,
      ) {
        dns.lookup(hostname, options, (err, address, family) => {
          if (err) return cb(err, address as string, family as number);
          const list: dns.LookupAddress[] = Array.isArray(address)
            ? (address as dns.LookupAddress[])
            : [{ address: address as string, family: family as number }];
          if (!list.every((a) => addressAllowed(a.address, insecure)))
            return cb(new TargetRejected("Blocked a connection to a non-public address.") as NodeJS.ErrnoException, "", 0);
          cb(null, address as string | dns.LookupAddress[], family as number);
        });
      },
    },
  });
}

export type SafeResponse = { status: number; bodyText: string; truncated: boolean };

/**
 * A single egress-guarded request. Refuses redirects, times out, and caps the body size.
 * Every call here is one of the run's budgeted requests.
 */
export async function safeRequest(
  urlStr: string,
  opts: { method?: string; headers?: Record<string, string>; body?: string; timeoutMs?: number; maxBytes?: number } = {},
): Promise<SafeResponse> {
  await assertSafeTarget(urlStr);
  const timeoutMs = Math.min(opts.timeoutMs ?? 15000, 20000);
  const maxBytes = Math.min(opts.maxBytes ?? 1_000_000, 2_000_000);
  const agent = guardedAgent();
  try {
    const res = await undiciRequest(urlStr, {
      method: (opts.method ?? "GET") as "GET" | "POST",
      headers: { "user-agent": "CyberHELP-Trust-RedTeam/1.0", ...(opts.headers ?? {}) },
      body: opts.body,
      dispatcher: agent,
      // undici.request does not follow redirects; a 3xx is surfaced and rejected below.
      headersTimeout: timeoutMs,
      bodyTimeout: timeoutMs,
    });
    if (res.statusCode >= 300 && res.statusCode < 400)
      throw new TargetRejected("The endpoint returned a redirect; the target must respond directly.");

    let total = 0;
    const chunks: Buffer[] = [];
    let truncated = false;
    for await (const chunk of res.body) {
      total += chunk.length;
      if (total > maxBytes) {
        truncated = true;
        break;
      }
      chunks.push(chunk as Buffer);
    }
    res.body.destroy();
    return { status: res.statusCode, bodyText: Buffer.concat(chunks).toString("utf8"), truncated };
  } finally {
    await agent.close().catch(() => {});
  }
}

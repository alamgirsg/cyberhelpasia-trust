import { appUrl } from "@/lib/email";

/** RFC 9116 security.txt so researchers know how to report issues. */
export function GET() {
  const expires = new Date(Date.now() + 365 * 864e5).toISOString();
  const body = [
    `Contact: mailto:security@cyberhelpasia.com`,
    `Expires: ${expires}`,
    `Preferred-Languages: en`,
    `Canonical: ${appUrl()}/.well-known/security.txt`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

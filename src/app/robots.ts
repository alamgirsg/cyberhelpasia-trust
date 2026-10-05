import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/email";

/** The marketing home may be indexed; the app, auth and invite/reset pages are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app/", "/login", "/signup", "/forgot", "/reset/", "/invite/", "/api/"] }],
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}

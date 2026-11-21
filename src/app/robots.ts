import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/privacidade", "/termos", "/login", "/cadastro"],
      disallow: ["/dashboard", "/api/", "/auth/"],
    },
    sitemap: "https://www.usedashfy.com.br/sitemap.xml",
  };
}

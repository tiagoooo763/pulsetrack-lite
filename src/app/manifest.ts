import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dashfy — Marketing & Gestão Financeira",
    short_name: "Dashfy",
    description:
      "Acompanhe campanhas, vendas em tempo real, ROAS, ROI e lucro líquido com alertas instantâneos no seu dispositivo.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#040914",
    theme_color: "#040914",
    lang: "pt-BR",
    icons: [
      {
        src: "/assets/logo-dashfy-icon.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/assets/logo-dashfy-icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

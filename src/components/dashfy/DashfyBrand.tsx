"use client";

import React from "react";

interface DashfyBrandProps {
  collapsed?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Componente oficial de marca Dashfy.
 * Exibe a logo principal (/assets/logo-dashfy.png) alinhada à esquerda sem distorção,
 * alternando automaticamente para o ícone compacto (/assets/logo-dashfy-icon.png) quando a sidebar está recolhida.
 */
export function DashfyBrand({
  collapsed = false,
  size = "md",
  className = "",
}: DashfyBrandProps) {
  const heightClass =
    size === "lg" ? "h-10" : size === "sm" ? "h-6" : "h-7";

  if (collapsed) {
    return (
      <div
        className={`flex items-center justify-center select-none ${className}`}
        title="Dashfy"
      >
        <img
          src="/assets/logo-dashfy-icon.png"
          alt="Dashfy"
          width={36}
          height={28}
          className="h-7 w-auto max-w-[36px] object-contain"
        />
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-start select-none ${className}`}
      title="Dashfy — Inteligência Financeira & Marketing"
    >
      <img
        src="/assets/logo-dashfy.png"
        alt="Dashfy"
        width={142}
        height={32}
        className={`${heightClass} w-auto max-w-[152px] object-contain object-left`}
      />
    </div>
  );
}

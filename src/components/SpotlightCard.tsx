"use client";

import React, { memo, useCallback, useRef } from "react";

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
}

/**
 * SpotlightCard de alta performance (ZERO re-renders React ao mover o mouse):
 * atualiza CSS custom properties diretamente no elemento via requestAnimationFrame.
 */
export const SpotlightCard = memo(function SpotlightCard({
  children,
  className = "",
  spotlightColor = "rgba(59, 139, 255, 0.09)",
  ...props
}: SpotlightCardProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = divRef.current;
    const overlay = overlayRef.current;
    if (!container || !overlay) return;

    const clientX = e.clientX;
    const clientY = e.clientY;

    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const rect = container.getBoundingClientRect();
      overlay.style.setProperty("--spot-x", `${clientX - rect.left}px`);
      overlay.style.setProperty("--spot-y", `${clientY - rect.top}px`);
    });
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (overlayRef.current) {
      overlayRef.current.style.opacity = "1";
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (overlayRef.current) {
      overlayRef.current.style.opacity = "0";
    }
  }, []);

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`card-spotlight relative ${className}`}
      {...props}
    >
      <div
        ref={overlayRef}
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity: 0,
          background: `radial-gradient(350px circle at var(--spot-x, 50%) var(--spot-y, 50%), ${spotlightColor}, transparent 80%)`,
        }}
        aria-hidden="true"
      />
      <div className="relative z-10 h-full w-full">{children}</div>
    </div>
  );
});

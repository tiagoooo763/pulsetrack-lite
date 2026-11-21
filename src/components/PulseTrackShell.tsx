"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { LoginScreen } from "./LoginScreen";
import { DashboardApp } from "./DashboardApp";

interface PulseTrackShellProps {
  initialAuthenticated: boolean;
}

export function PulseTrackShell({
  initialAuthenticated,
}: PulseTrackShellProps) {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);

  if (!authenticated) {
    return (
      <LoginScreen
        onSuccess={() => {
          setAuthenticated(true);
          router.push("/dashboard");
          router.refresh();
        }}
      />
    );
  }

  return (
    <DashboardApp
      onLogout={() => {
        setAuthenticated(false);
        router.push("/login");
        router.refresh();
      }}
    />
  );
}

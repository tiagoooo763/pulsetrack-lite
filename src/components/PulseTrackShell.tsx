"use client";

import React, { useState } from "react";
import { LoginScreen } from "./LoginScreen";
import { DashboardApp } from "./DashboardApp";

interface PulseTrackShellProps {
  initialAuthenticated: boolean;
}

export function PulseTrackShell({
  initialAuthenticated,
}: PulseTrackShellProps) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);

  if (!authenticated) {
    return <LoginScreen onSuccess={() => setAuthenticated(true)} />;
  }

  return <DashboardApp onLogout={() => setAuthenticated(false)} />;
}

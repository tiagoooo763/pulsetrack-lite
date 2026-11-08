import React from "react";
import { isAuthenticated } from "@/lib/auth";
import { PulseTrackShell } from "@/components/PulseTrackShell";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const authed = await isAuthenticated();
  return <PulseTrackShell initialAuthenticated={authed} />;
}

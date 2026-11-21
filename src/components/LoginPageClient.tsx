"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { LoginScreen } from "./LoginScreen";

export function LoginPageClient() {
  const router = useRouter();

  return (
    <LoginScreen
      onSuccess={() => {
        router.push("/dashboard");
        router.refresh();
      }}
    />
  );
}

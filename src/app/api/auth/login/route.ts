import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  getExpectedDashboardCredentials,
  SESSION_COOKIE_NAME,
  timingSafeStringCompare,
} from "@/lib/auth";
import { safeLog } from "@/lib/sanitize";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
    };

    const username = (body.username || "").trim().toLowerCase();
    const password = body.password || "";

    const expected = await getExpectedDashboardCredentials();
    const expectedUser = expected.username.toLowerCase();

    const userMatch =
      timingSafeStringCompare(username, expectedUser) ||
      (expectedUser === "mendoncat831@gmail.com" &&
        timingSafeStringCompare(username, "admin")) ||
      (expectedUser === "admin" &&
        timingSafeStringCompare(username, "mendoncat831@gmail.com"));

    const passMatch = timingSafeStringCompare(password, expected.password);

    if (!userMatch || !passMatch) {
      safeLog("warn", "Tentativa de login inválida no painel PulseTrack Lite.");
      return NextResponse.json(
        { error: "Usuário ou senha inválidos." },
        { status: 401 }
      );
    }

    const token = createSessionToken(expected.username);
    const response = NextResponse.json({ ok: true, username: expected.username });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    safeLog("info", "Sessão iniciada com sucesso no painel PulseTrack Lite.");
    return response;
  } catch {
    return NextResponse.json(
      { error: "Não foi possível processar o login." },
      { status: 400 }
    );
  }
}

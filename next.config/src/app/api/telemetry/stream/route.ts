import { NextRequest } from "next/server";
import { API_BASE_URL } from "@/api/client";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("himshravan_auth")?.value;

  const headers: Record<string, string> = {
    Accept: "*/*",
    "Cache-Control": "no-cache",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const backendResponse = await fetch(`${API_BASE_URL}/telemetry/stream/`, {
    headers,
  });

  if (!backendResponse.ok) {
    return new Response("Backend stream error", {
      status: backendResponse.status,
    });
  }

  return new Response(backendResponse.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

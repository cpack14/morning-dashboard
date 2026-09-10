import { getGoogleAccessToken } from "@/lib/googleCalendar";

export type GmailMessageSummary = { id: string };

export async function searchGmailMessages(
  refreshToken: string,
  query: string,
  maxResults = 20,
): Promise<GmailMessageSummary[]> {
  const accessToken = await getGoogleAccessToken(refreshToken);

  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", String(maxResults));

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Gmail search failed (${res.status})`);
  }

  const data = await res.json();
  return data.messages ?? [];
}

// Recursively finds and decodes the first text/plain part of a Gmail
// message payload — MIME bodies can nest multipart/alternative parts
// arbitrarily deep depending on how the sender built the email.
function extractPlainTextBody(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const part = payload as {
    mimeType?: string;
    body?: { data?: string };
    parts?: unknown[];
  };

  if (part.mimeType === "text/plain" && part.body?.data) {
    return Buffer.from(part.body.data, "base64url").toString("utf-8");
  }

  for (const child of part.parts ?? []) {
    const found = extractPlainTextBody(child);
    if (found) return found;
  }

  return null;
}

export async function getGmailMessagePlainText(
  refreshToken: string,
  messageId: string,
): Promise<string | null> {
  const accessToken = await getGoogleAccessToken(refreshToken);

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    throw new Error(`Gmail message fetch failed (${res.status})`);
  }

  const data = await res.json();
  return extractPlainTextBody(data.payload);
}

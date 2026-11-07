import "server-only";
import { NextResponse } from "next/server";
import { AuthorizationError } from "@/server/auth/permissions";

/** Uniform, safe JSON errors for route handlers (no stack traces or internals). */
export function apiError(err: unknown) {
  if (err instanceof AuthorizationError) return NextResponse.json({ error: "You do not have permission to do that." }, { status: 403 });
  if (err && typeof err === "object" && "digest" in err && String((err as { digest: string }).digest).startsWith("NEXT_REDIRECT")) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  console.error("[api]", err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

/** NDJSON streaming response helper. */
export function ndjson(gen: AsyncIterable<unknown>, onAbort?: () => void): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of gen) controller.enqueue(enc.encode(`${JSON.stringify(ev)}\n`));
      } catch (err) {
        console.error("[stream]", err);
        controller.enqueue(enc.encode(`${JSON.stringify({ type: "error", error: "The stream was interrupted." })}\n`));
      } finally {
        controller.close();
      }
    },
    cancel() {
      onAbort?.();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
}

// Demo flags, so the slow and failing board states come from the real API.
// Only active when DEMO_FLAGS=1.
//   ?latency=2000  waits 2 seconds before handling the request (capped at 10s)
//   ?fail=1        fails every request with a 503; ?fail=0.3 fails 30% of them
// Both run before the handler, so a simulated failure never writes anything.

const MAX_LATENCY_MS = 10_000;

function readNumber(params: URLSearchParams, name: string, max: number): number {
  const value = Number(params.get(name));
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(value, max);
}

export function demoFlagsEnabled() {
  return process.env.DEMO_FLAGS === "1";
}

/** Returns a failure response to send instead of handling the request, or null. */
export async function demoResponse(request: Request): Promise<Response | null> {
  if (!demoFlagsEnabled()) return null;
  const params = new URL(request.url).searchParams;

  const latency = readNumber(params, "latency", MAX_LATENCY_MS);
  if (latency > 0) await new Promise((resolve) => setTimeout(resolve, latency));

  const failRate = readNumber(params, "fail", 1);
  if (failRate > 0 && Math.random() < failRate) {
    return Response.json(
      { error: { code: "demo_failure", message: "Simulated failure from the demo flags. Nothing was saved.", details: null } },
      { status: 503 },
    );
  }
  return null;
}

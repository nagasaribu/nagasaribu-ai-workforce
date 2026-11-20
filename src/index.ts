export interface Env {
  APP_ENV: string;
}

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        ok: true,
        service: "nagasaribu-ai-workforce",
        environment: env.APP_ENV ?? "unknown",
        phase: 1,
        status: "foundation",
      });
    }

    if (request.method === "GET" && url.pathname === "/") {
      return json({
        name: "NAGASARIBU AI WORKFORCE",
        message: "Central AI Workforce API foundation",
        phase: 1,
        health: "/health",
      });
    }

    return json({ error: "Not found" }, 404);
  },
};

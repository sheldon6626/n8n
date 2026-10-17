import { DurableObject } from "cloudflare:workers";

interface Env {
  N8N: DurableObjectNamespace<N8NContainer>;
  N8N_ENCRYPTION_KEY: string;
  DB_POSTGRESDB_HOST: string;
  DB_POSTGRESDB_PORT?: string;
  DB_POSTGRESDB_DATABASE: string;
  DB_POSTGRESDB_USER: string;
  DB_POSTGRESDB_PASSWORD: string;
}

export class N8NContainer extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const container = this.ctx.container;
    if (!container) return new Response("Container is not configured", { status: 500 });
    if (!this.env.N8N_ENCRYPTION_KEY || !this.env.DB_POSTGRESDB_HOST ||
        !this.env.DB_POSTGRESDB_DATABASE || !this.env.DB_POSTGRESDB_USER ||
        !this.env.DB_POSTGRESDB_PASSWORD) {
      return new Response("n8n database and encryption secrets are required", { status: 503 });
    }

    await container.setInactivityTimeout(10 * 60 * 1000);
    if (!container.running) {
      container.start({
        enableInternet: true,
        env: {
          N8N_HOST: "n8n.now9888.com",
          N8N_PORT: "5678",
          N8N_PROTOCOL: "https",
          N8N_EDITOR_BASE_URL: "https://n8n.now9888.com/",
          WEBHOOK_URL: "https://n8n.now9888.com/",
          N8N_PROXY_HOPS: "1",
          GENERIC_TIMEZONE: "Asia/Shanghai",
          TZ: "Asia/Shanghai",
          N8N_DEFAULT_BINARY_DATA_MODE: "database",
          N8N_ENCRYPTION_KEY: this.env.N8N_ENCRYPTION_KEY,
          DB_TYPE: "postgresdb",
          DB_POSTGRESDB_HOST: this.env.DB_POSTGRESDB_HOST,
          DB_POSTGRESDB_PORT: this.env.DB_POSTGRESDB_PORT ?? "5432",
          DB_POSTGRESDB_DATABASE: this.env.DB_POSTGRESDB_DATABASE,
          DB_POSTGRESDB_USER: this.env.DB_POSTGRESDB_USER,
          DB_POSTGRESDB_PASSWORD: this.env.DB_POSTGRESDB_PASSWORD,
          DB_POSTGRESDB_SSL_ENABLED: "true",
          EXECUTIONS_DATA_PRUNE: "true"
        }
      });
    }

    const port = container.getTcpPort(5678);
    for (let attempt = 0; attempt < 120; attempt++) {
      try {
        const health = await port.fetch("http://container/healthz/readiness");
        if (health.ok) {
          const url = new URL(request.url);
          url.protocol = "http:";
          url.host = "container";
          const forwarded = new Request(url, request);
          forwarded.headers.set("X-Forwarded-Proto", "https");
          forwarded.headers.set("X-Forwarded-Host", "n8n.now9888.com");
          forwarded.headers.set("X-Forwarded-For", request.headers.get("CF-Connecting-IP") ?? "127.0.0.1");
          return port.fetch(forwarded);
        }
      } catch {
        // The container port is unavailable while n8n starts and migrates its database.
      }
      await scheduler.wait(500);
    }
    return new Response("n8n is starting; retry shortly", { status: 503, headers: { "Retry-After": "10" } });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const container = env.N8N.getByName("n8n");
    return container.fetch(request);
  },
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    const response = await env.N8N.getByName("n8n").fetch("https://n8n.now9888.com/healthz/readiness");
    if (!response.ok) throw new Error(`n8n readiness check failed: ${response.status}`);
  }
};

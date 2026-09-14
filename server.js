import express from "express";
import { getCatalog } from "./src/catalog.js";
import { getMeta } from "./src/meta.js";
import { getStreams } from "./src/streams.js";

/*
|--------------------------------------------------------------------------
| Process-level safety nets — the server must NEVER crash
|--------------------------------------------------------------------------
*/

process.on("uncaughtException", (error) => {
  console.error("[uncaughtException] Server caught:", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection] Server caught:", reason);
});

/*
|--------------------------------------------------------------------------
| Express setup
|--------------------------------------------------------------------------
*/

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const BASE_URL =
  process.env.BASE_URL || `http://localhost:${PORT}`;
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";

app.use(express.json({ limit: "1mb" }));

/*
|--------------------------------------------------------------------------
| CORS — Stremio needs open CORS
|--------------------------------------------------------------------------
*/

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Range"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, HEAD, OPTIONS"
  );
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  next();
});

/*
|--------------------------------------------------------------------------
| HTTPS enforcement in production
|--------------------------------------------------------------------------
*/

app.use((req, res, next) => {
  if (!IS_PRODUCTION) return next();

  const fwdProto = req.headers["x-forwarded-proto"];
  const fwdSsl = req.headers["x-forwarded-ssl"];

  const isHttps =
    req.protocol === "https" ||
    fwdProto === "https" ||
    fwdSsl === "on" ||
    fwdSsl === "1";

  if (!isHttps) {
    try {
      const target = new URL(req.originalUrl, BASE_URL).href;
      return res.redirect(301, target);
    } catch {
      // Fallback: if BASE_URL parse fails, let it through
    }
  }

  next();
});

/*
|--------------------------------------------------------------------------
| Security / informational headers
|--------------------------------------------------------------------------
*/

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  next();
});

/*
|--------------------------------------------------------------------------
| Root / status
|--------------------------------------------------------------------------
*/

app.get("/", (_req, res) => {
  res.json({
    name: "3seq Stremio Addon",
    version: "1.0.0",
    status: "online",
    environment: NODE_ENV,
    manifest: `${BASE_URL}/manifest.json`,
    health: `${BASE_URL}/health`
  });
});

/*
|--------------------------------------------------------------------------
| Manifest
|--------------------------------------------------------------------------
*/

app.get("/manifest.json", (_req, res) => {
  res.json({
    id: "com.3seq.stremio",
    version: "1.0.0",
    name: "3seq - قصة عشق",
    description:
      "Addon Stremio officiel pour les contenus autorisés de u.3seq.cam (séries et films).",
    logo: "https://u.3seq.cam/wp-content/uploads/2025/04/logo.png",
    background:
      "https://u.3seq.cam/wp-content/uploads/2025/04/logo.png",
    types: ["series", "movie"],
    resources: [
      {
        name: "catalog",
        types: ["series", "movie"],
        idPrefixes: ["3seq:"]
      },
      {
        name: "meta",
        types: ["series", "movie"],
        idPrefixes: ["3seq:"]
      },
      {
        name: "stream",
        types: ["series", "movie"],
        idPrefixes: ["3seq:"]
      }
    ],
    catalogs: [
      {
        type: "series",
        id: "3seq-series",
        name: "3seq - أحدث المسلسلات",
        extra: [
          {
            name: "search",
            isRequired: false
          }
        ]
      },
      {
        type: "movie",
        id: "3seq-movies",
        name: "3seq - أحدث الأفلام",
        extra: [
          {
            name: "search",
            isRequired: false
          }
        ]
      }
    ],
    idPrefixes: ["3seq:"]
  });
});

/*
|--------------------------------------------------------------------------
| Catalog
|--------------------------------------------------------------------------
*/

app.get(
  "/catalog/:type/:catalogId.json",
  async (req, res) => {
    try {
      const { type, catalogId } = req.params;
      const search =
        typeof req.query.search === "string" ? req.query.search : "";

      if (type !== "series" && type !== "movie") {
        return res.status(200).json({ metas: [] });
      }

      const metas = await getCatalog({
        type,
        catalogId,
        search
      });

      res.status(200).json({ metas });
    } catch (error) {
      console.error("[route/catalog]", error);
      res.status(200).json({ metas: [] });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Meta
|--------------------------------------------------------------------------
*/

app.get("/meta/:type/:id.json", async (req, res) => {
  try {
    const { type, id } = req.params;

    if (type !== "series" && type !== "movie") {
      return res.status(200).json({ meta: {} });
    }

    const meta = await getMeta({ type, id });

    if (!meta) {
      return res.status(200).json({ meta: {} });
    }

    res.status(200).json({ meta });
  } catch (error) {
    console.error("[route/meta]", error);
    res.status(200).json({ meta: {} });
  }
});

/*
|--------------------------------------------------------------------------
| Streams
|--------------------------------------------------------------------------
*/

app.get("/stream/:type/:id.json", async (req, res) => {
  try {
    const { type, id } = req.params;

    if (type !== "series" && type !== "movie") {
      return res.status(200).json({ streams: [] });
    }

    const streams = await getStreams({ type, id });

    res.status(200).json({ streams });
  } catch (error) {
    console.error("[route/stream]", error);
    res.status(200).json({ streams: [] });
  }
});

/*
|--------------------------------------------------------------------------
| Health check
|--------------------------------------------------------------------------
*/

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  });
});

/*
|--------------------------------------------------------------------------
| 404 — always return JSON, never HTML
|--------------------------------------------------------------------------
*/

app.use((_req, res) => {
  res.status(404).json({
    error: "Not Found",
    status: 404,
    manifest: `${BASE_URL}/manifest.json`
  });
});

/*
|--------------------------------------------------------------------------
| Start
|--------------------------------------------------------------------------
*/

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║  3seq Stremio Addon                              ║
╠══════════════════════════════════════════════════╣
║  NODE_ENV : ${NODE_ENV.padEnd(37)}║
║  PORT     : ${String(PORT).padEnd(37)}║
║  BASE_URL : ${BASE_URL.padEnd(37)}║
╠══════════════════════════════════════════════════╣
║  /health        -> ${BASE_URL}/health${" ".repeat(Math.max(0, 24 - BASE_URL.length))}║
║  /manifest.json -> ${BASE_URL}/manifest.json${" ".repeat(Math.max(0, 15 - BASE_URL.length))}║
╚══════════════════════════════════════════════════╝
`);
});

server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

export { app, server };

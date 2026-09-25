import express, { type ErrorRequestHandler, type Express } from "express";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

function containsUnsafeControls(value: unknown, depth = 0): boolean {
  if (depth > 20) return true;
  if (typeof value === "string") return /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
  if (Array.isArray(value)) return value.some((item) => containsUnsafeControls(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.entries(value).some(([key, item]) =>
      containsUnsafeControls(key, depth + 1) || containsUnsafeControls(item, depth + 1));
  }
  return false;
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  res.setHeader("Cache-Control", "no-store");

  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const origin = req.get("origin");
    const fetchSite = req.get("sec-fetch-site");
    const host = req.get("host");
    let sameOrigin = false;
    if (origin && host) {
      try {
        const parsed = new URL(origin);
        sameOrigin = (parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.host === host;
      } catch {
        // Malformed and opaque origins are not trusted.
      }
    }
    if (fetchSite === "cross-site" || (origin && !sameOrigin) || (req.headers.cookie && !sameOrigin)) {
      res.status(403).json({ error: "This request must come from the same site." });
      return;
    }
  }
  next();
});
app.use(express.json({ limit: "100kb", strict: true }));
app.use((req, res, next) => {
  if (containsUnsafeControls(req.body) || containsUnsafeControls(req.query) || containsUnsafeControls(req.params)) {
    res.status(400).json({ error: "The request contains unsupported control characters." });
    return;
  }
  next();
});

app.use("/api", router);

const handleError: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  if (res.headersSent) return;
  if (error && typeof error === "object" && "type" in error && error.type === "entity.too.large") {
    res.status(413).json({ error: "The request is too large." });
    return;
  }
  if (error && typeof error === "object" && "status" in error && error.status === 400) {
    res.status(400).json({ error: "The request body is invalid." });
    return;
  }
  req.log.error({ error }, "API request failed");
  res.status(500).json({ error: "The request could not be completed." });
};
app.use(handleError);

export default app;

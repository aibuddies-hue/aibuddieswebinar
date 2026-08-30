/**
 * Minimal static file server, no dependencies.
 *
 * This project is a static site, but hosts that see a package.json (Hostinger,
 * Render, Railway, and friends) treat it as a Node app and run `npm start`.
 * The previous start script shelled out to `python3 -m http.server 8002`, which
 * fails twice over on such a host: python3 usually is not installed, and the
 * port is hardcoded instead of read from PORT, so nothing is listening where
 * the platform's proxy looks — a completed deploy that still answers 503.
 *
 * Serving the same files from Node fixes both. If you would rather host this as
 * a plain static site (no Node process at all), that works too — point the host
 * at the repo root with no build step and this file is simply never used.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".ics": "text/calendar; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8"
};

// Hashed names are not in use here, so HTML must revalidate or visitors keep
// seeing an old page after a deploy. Static assets can be cached hard.
function cacheControl(ext) {
  if (ext === ".html" || ext === "") return "no-cache";
  return "public, max-age=604800";
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "X-Content-Type-Options": "nosniff", ...headers });
  res.end(body);
}

function serveFile(req, res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) return notFound(res);

    const headers = {
      "Content-Type": type,
      "Content-Length": stat.size,
      "Cache-Control": cacheControl(ext),
      "Last-Modified": stat.mtime.toUTCString()
    };

    // A HEAD request must not carry a body, but keeps the same headers.
    if (req.method === "HEAD") return send(res, 200, null, headers);

    res.writeHead(200, { "X-Content-Type-Options": "nosniff", ...headers });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on("error", () => res.destroy());
  });
}

function notFound(res) {
  send(res, 404, "404 — Not found", { "Content-Type": "text/plain; charset=utf-8" });
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return send(res, 405, "Method not allowed", {
      "Content-Type": "text/plain; charset=utf-8",
      Allow: "GET, HEAD"
    });
  }

  let pathname;
  try {
    // Filenames in assets/ contain spaces, so the path must be decoded.
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch (err) {
    return send(res, 400, "Bad request", { "Content-Type": "text/plain; charset=utf-8" });
  }

  if (pathname === "/") pathname = "/index.html";

  // Resolve first, then confirm the result is still inside ROOT. This is what
  // stops "../" and encoded traversal from reaching files outside the site.
  const resolved = path.resolve(ROOT, "." + pathname);
  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) {
    return send(res, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" });
  }

  fs.stat(resolved, (err, stat) => {
    if (!err && stat.isDirectory()) {
      return serveFile(req, res, path.join(resolved, "index.html"));
    }
    if (!err) return serveFile(req, res, resolved);

    // Allow extensionless URLs such as /thank-you to reach thank-you.html.
    if (!path.extname(resolved)) {
      const asHtml = resolved + ".html";
      return fs.stat(asHtml, (e2) => (e2 ? notFound(res) : serveFile(req, res, asHtml)));
    }
    notFound(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Static server listening on http://${HOST}:${PORT}`);
});

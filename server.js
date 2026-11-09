const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "public");
const endpoints = [
  "evaluations",
  "health",
  "members",
  "leader",
  "delete",
  "stats",
  "evaluation",
];
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
};
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(data));
  };
  req.query = Object.fromEntries(url.searchParams);
  if (url.pathname.startsWith("/api/")) {
    const endpoint = url.pathname.slice(5);
    if (!endpoints.includes(endpoint))
      return res.status(404).json({ error: "Não encontrado." });
    try {
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (Buffer.byteLength(raw) > 200000)
          return res.status(413).json({ error: "Envio muito grande." });
      }
      req.body = raw ? JSON.parse(raw) : {};
      await require(`./api/${endpoint}`)(req, res);
    } catch {
      if (!res.headersSent)
        res.status(400).json({ error: "Requisição inválida." });
    }
    return;
  }
  let file;
  try {
    file = path.resolve(
      root,
      "." +
        decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname),
    );
  } catch {
    return res.status(400).end();
  }
  if (!file.startsWith(root + path.sep)) return res.status(403).end();
  fs.readFile(file, (error, data) => {
    if (error) return res.status(404).end("Não encontrado.");
    res.setHeader(
      "Content-Type",
      types[path.extname(file)] || "application/octet-stream",
    );
    res.setHeader("Cache-Control", "no-store");
    res.end(data);
  });
});
server.listen(Number(process.env.PORT || 4183), "127.0.0.1", () =>
  console.log(`STEM: http://localhost:${process.env.PORT || 4183}`),
);

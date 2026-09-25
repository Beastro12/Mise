// Serves tests/fixtures over HTTP so URL import can be exercised without internet access.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const port = Number(process.env.FIXTURE_PORT || 4599);

http
  .createServer((req, res) => {
    const name = path.basename(new URL(req.url, "http://x").pathname);
    const file = path.join(dir, name);
    if (!name || !fs.existsSync(file)) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": name.endsWith(".html") ? "text/html; charset=utf-8" : name.endsWith(".jpg") ? "image/jpeg" : "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, "127.0.0.1", () => console.log(`fixtures on ${port}`));

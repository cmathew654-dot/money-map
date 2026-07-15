const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

const REPO_ROOT = path.join(__dirname, "..", "..");
const PORT = Number(process.env.MONEY_MAP_AUDIT_PORT) || 54217;
const URL = `http://127.0.0.1:${PORT}/index.html?test=1`;

function canReachServer() {
  return new Promise((resolve) => {
    const req = http.get(URL, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function startAuditServer() {
  if (await canReachServer()) return { url: URL, stop: async () => {} };

  const httpServerScript = require.resolve("http-server/bin/http-server");
  const child = spawn(process.execPath, [httpServerScript, "-p", String(PORT), "--silent"], {
    cwd: REPO_ROOT,
    stdio: "ignore"
  });

  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await canReachServer()) {
      return {
        url: URL,
        stop: async () => {
          child.kill();
        }
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  child.kill();
  throw new Error(`Timed out starting http-server on port ${PORT}`);
}

module.exports = { startAuditServer };

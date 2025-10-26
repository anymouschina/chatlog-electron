import { app as _, BrowserWindow as V, ipcMain as S, dialog as J, shell as st } from "electron";
import { createRequire as ot } from "node:module";
import { fileURLToPath as it } from "node:url";
import s from "node:path";
import { spawn as K } from "node:child_process";
import ct from "wait-on";
import D from "node:fs";
const k = ot(import.meta.url), U = s.dirname(it(import.meta.url));
process.env.APP_ROOT = s.join(U, "..");
const L = process.env.VITE_DEV_SERVER_URL, St = s.join(process.env.APP_ROOT, "dist-electron"), z = s.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = L ? s.join(process.env.APP_ROOT, "public") : z;
let v, l = null, i = {}, w = {}, I = "";
function at() {
  try {
    if (I && D.existsSync(I)) {
      const e = D.readFileSync(I, "utf-8");
      return JSON.parse(e);
    }
  } catch {
  }
  return {};
}
function q(e) {
  try {
    if (!I) return;
    D.mkdirSync(s.dirname(I), { recursive: !0 }), D.writeFileSync(I, JSON.stringify(e, null, 2), "utf-8");
  } catch {
  }
}
function X() {
  const e = process.env.APP_ROOT || s.join(U, "..");
  return s.resolve(e, "..", "..");
}
function Q() {
  const e = [
    s.join(process.resourcesPath || "", "chatlog", "chatlog"),
    // folder + binary
    s.join(process.resourcesPath || "", "chatlog"),
    // plain file
    s.join(process.resourcesPath || "", "Resources", "chatlog")
  ];
  for (const t of e)
    try {
      if (t && k("fs").existsSync(t)) return t;
    } catch {
    }
  return null;
}
function ut() {
  const e = k("os").homedir(), t = process.platform;
  if (t === "darwin") {
    const r = [
      s.join(e, "Library/Containers/com.tencent.xinWeChat/Data/Library/Application Support/com.tencent.xinWeChat"),
      s.join(e, "Library/Application Support/com.tencent.xinWeChat"),
      s.join(e, "Documents/WeChat Files")
    ];
    for (const n of r)
      try {
        const d = s.join(n, "2.0b4.0.9");
        if (k("fs").existsSync(d)) {
          const h = k("fs").readdirSync(d).filter((m) => {
            const R = s.join(d, m);
            try {
              return k("fs").statSync(R).isDirectory() && m.length === 32;
            } catch {
              return !1;
            }
          });
          if (h.length > 0) {
            const m = s.join(d, h[0]);
            return console.log(`Detected WeChat subdirectory structure: ${m}`), m;
          }
          if (k("fs").existsSync(s.join(d, "Message")))
            return d;
        }
      } catch {
      }
  } else if (t === "win32") {
    const r = [
      s.join(e, "Documents", "WeChat Files"),
      s.join(e, "AppData", "Roaming", "Tencent", "WeChat"),
      s.join("C:\\Program Files (x86)\\Tencent\\WeChat"),
      s.join("C:\\Program Files\\Tencent\\WeChat")
    ];
    for (const n of r)
      try {
        if (k("fs").existsSync(n)) {
          const P = k("fs").readdirSync(n).filter((h) => {
            const m = s.join(n, h);
            try {
              return k("fs").statSync(m).isDirectory() && h.includes("wxid_");
            } catch {
              return !1;
            }
          });
          if (P.length > 0) {
            const h = s.join(n, P[0]);
            return console.log(`Detected Windows WeChat data directory: ${h}`), h;
          }
          if (k("fs").existsSync(s.join(n, "Message")))
            return n;
        }
      } catch {
      }
  }
  return null;
}
function lt(e) {
  const t = !!(e.dataDir && e.dataDir.length) || !!(e.workDir && e.workDir.length), r = !!(e.dataKey && e.dataKey.length);
  return t && r;
}
function dt(e) {
  const t = ["server"], r = e.platform || (process.platform === "darwin" ? "darwin" : process.platform === "win32" ? "windows" : ""), n = e.version && e.version > 0 ? e.version : 3;
  return e.addr && t.push("--addr", e.addr), e.dataDir && t.push("--data-dir", e.dataDir), e.dataKey && e.dataKey !== "default-key-for-initial-setup" && t.push("--data-key", e.dataKey), e.imgKey && t.push("--img-key", e.imgKey), e.workDir && t.push("--work-dir", e.workDir), r && t.push("--platform", r), n && t.push("--version", String(n)), t.push("--auto-decrypt"), t;
}
async function G(e = !1) {
  return new Promise((t) => {
    if (!l) return t();
    const r = l;
    l = null;
    const n = setTimeout(() => {
      try {
        r.kill("SIGKILL");
      } catch {
      }
      t();
    }, e ? 200 : 1500);
    r.once("exit", () => {
      clearTimeout(n), t();
    });
    try {
      r.kill("SIGTERM");
    } catch {
      try {
        r.kill();
      } catch {
      }
    }
  });
}
async function Y(e) {
  var $, g;
  if (e && (i = { ...i, ...e }), !i.dataDir) {
    const o = ut();
    o && (i.dataDir = o, console.log(`Auto-detected WeChat data directory: ${o}`));
  }
  w = { ...w, ...i }, q(w), await G();
  const t = X(), r = process.platform === "win32" ? "chatlog.exe" : "chatlog", n = Q();
  let h = [
    process.env.CHATLOG_BIN,
    n,
    s.join(t, "packages", "chatlog_macos", "chatlog"),
    s.join(t, "bin", r)
  ].filter(Boolean).find((o) => {
    try {
      return k("fs").existsSync(o);
    } catch {
      return !1;
    }
  }) || "";
  const m = i.addr || process.env.CHATLOG_HTTP_ADDR || "127.0.0.1:5030";
  i.addr = m;
  const R = { ...process.env, CHATLOG_HTTP_ADDR: m }, j = process.resourcesPath || t;
  console.log("Starting backend - it will auto-acquire dataKey if needed");
  const C = h, f = dt(i);
  console.log(`Attempting to start backend: ${C} ${f.join(" ")}`), console.log(`Working directory: ${j}`), console.log(`Binary exists: ${k("fs").existsSync(C)}`);
  const x = _.getPath("userData"), u = s.join(x, "chatlog-server.log");
  try {
    D.mkdirSync(x, { recursive: !0 });
  } catch {
  }
  try {
    l = K(C, f, { cwd: j, env: R, stdio: "pipe" }), console.log("Backend spawned successfully");
  } catch (o) {
    console.log(`Failed to spawn backend: ${o}`);
    const c = process.platform === "win32" ? "go.exe" : "go";
    console.log(`Falling back to go run: ${c} run . ${f.join(" ")}`), l = K(c, ["run", ".", ...f], { cwd: j, env: R, stdio: "pipe" });
  }
  const p = (o) => {
    try {
      D.appendFileSync(u, o);
    } catch {
    }
  };
  ($ = l == null ? void 0 : l.stdout) == null || $.on("data", (o) => {
    const c = String(o);
    process.stdout.write(`[server] ${c}`), p(c);
  }), (g = l == null ? void 0 : l.stderr) == null || g.on("data", (o) => {
    const c = String(o);
    process.stderr.write(`[server] ${c}`), p(c);
  }), l == null || l.on("exit", async (o, c) => {
    l = null, p(`
[server] exited code=${o} signal=${c}
`);
  }), console.log(`Waiting for backend health check at http://${m}/health`);
  try {
    await ct({ resources: [`http://${m}/health`], timeout: 3e4, validateStatus: () => !0 }), console.log("Backend health check passed - backend should now have auto-acquired dataKey if needed");
  } catch (o) {
    throw console.log(`Backend health check failed: ${o}`), o;
  }
}
function Z() {
  const e = !!L;
  v = new V({
    icon: s.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    title: "群聊总结大师",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: process.platform === "darwin" ? { x: 14, y: 14 } : void 0,
    backgroundColor: "#1e1e1e",
    width: 1200,
    height: 900,
    minHeight: 860,
    webPreferences: {
      preload: s.join(U, "preload.mjs"),
      webSecurity: !e
      // relax CORS in dev for API calls
    }
  }), v.webContents.on("did-finish-load", () => {
    v == null || v.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
    const t = lt(i);
    v == null || v.webContents.send("config:status", {
      configured: t,
      needsConfig: !t,
      configKeys: {
        hasDataDir: !!(i.dataDir && i.dataDir.length) || !!(i.workDir && i.workDir.length),
        hasDataKey: !!(i.dataKey && i.dataKey.length)
      }
    });
  }), L ? v.loadURL(L) : v.loadFile(s.join(z, "index.html"));
}
_.on("window-all-closed", async () => {
  if (process.platform !== "darwin") {
    try {
      l == null || l.kill("SIGTERM");
    } catch {
    }
    _.quit(), v = null;
  }
});
_.on("activate", () => {
  V.getAllWindows().length === 0 && Z();
});
_.on("before-quit", async () => {
  try {
    await G(!0);
  } catch {
  }
});
_.whenReady().then(async () => {
  I = s.join(_.getPath("userData"), "chatlog-electron.json"), w = at(), i = { ...i, ...w };
  const e = i.addr || process.env.CHATLOG_HTTP_ADDR || "127.0.0.1:5030";
  try {
    await Y({ addr: e }), console.log("Backend started (auto-detect mode)");
  } catch (t) {
    console.log("Backend failed to auto-start:", t);
  }
  Z();
});
S.handle("backend:getState", async () => ({ running: !!l, addr: i.addr || "127.0.0.1:5030" }));
S.handle("backend:start", async (e, t) => {
  try {
    return w.useExternal ? (i = { ...i, ...t }, w = { ...w, ...i }, q(w), { ok: !0 }) : (await Y(t), { ok: !0 });
  } catch (r) {
    return { ok: !1, error: (r == null ? void 0 : r.message) || String(r) };
  }
});
S.handle("backend:stop", async () => (w.useExternal || await G(!0), { ok: !0 }));
function tt(e, t) {
  const r = X(), n = process.platform === "win32" ? "chatlog.exe" : "chatlog", d = Q(), P = process.env.CHATLOG_BIN, h = k("fs"), m = [
    P,
    d,
    s.join(r, "packages", "chatlog_macos", "chatlog"),
    s.join(r, "bin", n)
  ].filter(Boolean), R = { ...process.env }, j = process.resourcesPath || r;
  return new Promise((C) => {
    let f = "", x = "";
    const u = (p) => {
      if (p >= m.length) {
        const g = process.platform === "win32" ? "go.exe" : "go", o = K(g, ["run", ".", ...e], { cwd: j, env: R });
        o.stdout.on("data", (c) => f += String(c)), o.stderr.on("data", (c) => x += String(c)), o.on("error", (c) => {
          x += `
${(c == null ? void 0 : c.message) || c}`;
        }), o.on("exit", (c) => C({ code: c, stdout: f, stderr: x }));
        return;
      }
      const $ = m[p];
      try {
        if (!h.existsSync($)) return u(p + 1);
        const g = K($, e, { cwd: j, env: R });
        g.stdout.on("data", (o) => f += String(o)), g.stderr.on("data", (o) => x += String(o)), g.on("error", (o) => {
          u(p + 1);
        }), g.on("exit", (o) => C({ code: o, stdout: f, stderr: x }));
      } catch {
        u(p + 1);
      }
    };
    u(0);
  });
}
S.handle("op:getDataKey", async (e, t) => {
  const r = ["key"];
  t != null && t.pid && r.push("--pid", String(t.pid)), t != null && t.force && r.push("--force"), t != null && t.showXorKey && r.push("--xor-key");
  const n = await tt(r);
  return n.code === 0 ? { ok: !0, output: n.stdout.trim() } : { ok: !1, error: n.stderr || n.stdout };
});
S.handle("op:decrypt", async (e, t) => {
  const r = ["decrypt"];
  t != null && t.platform && r.push("--platform", t.platform), t != null && t.version && r.push("--version", String(t.version)), t != null && t.dataDir && r.push("--data-dir", t.dataDir), t != null && t.dataKey && r.push("--data-key", t.dataKey), t != null && t.workDir && r.push("--work-dir", t.workDir);
  const n = await tt(r);
  return n.code === 0 ? { ok: !0, output: n.stdout.trim() } : { ok: !1, error: n.stderr || n.stdout };
});
S.handle("config:get", async () => w);
S.handle("config:set", async (e, t) => (w = { ...w, ...t }, i = { ...i, ...t }, q(w), { ok: !0 }));
S.handle("dialog:selectDirectory", async () => {
  var t;
  const e = await J.showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
  return e.canceled || !((t = e.filePaths) != null && t.length) ? { canceled: !0 } : { canceled: !1, path: e.filePaths[0] };
});
S.handle("file:saveDataUrl", async (e, t) => {
  try {
    const r = String((t == null ? void 0 : t.dataUrl) || "");
    if (!r.startsWith("data:image/")) return { ok: !1, error: "无效的图片数据" };
    const n = await J.showSaveDialog({
      defaultPath: (t == null ? void 0 : t.defaultPath) || "summary.png",
      filters: [{ name: "PNG Image", extensions: ["png"] }]
    });
    if (n.canceled || !n.filePath) return { ok: !1, canceled: !0 };
    const d = n.filePath, P = r.split(",")[1], h = Buffer.from(P, "base64");
    return D.writeFileSync(d, h), { ok: !0, path: d };
  } catch (r) {
    return { ok: !1, error: (r == null ? void 0 : r.message) || String(r) };
  }
});
S.handle("logs:read", async () => {
  try {
    const e = _.getPath("userData"), t = s.join(e, "chatlog-server.log");
    let r = "";
    try {
      r = D.readFileSync(t, "utf-8");
    } catch {
      r = "";
    }
    const n = D.existsSync(t) ? D.statSync(t) : null;
    return { ok: !0, content: r, size: (n == null ? void 0 : n.size) || 0, mtime: (n == null ? void 0 : n.mtimeMs) || 0, path: t };
  } catch (e) {
    return { ok: !1, error: (e == null ? void 0 : e.message) || String(e) };
  }
});
S.handle("logs:open", async () => {
  try {
    const e = s.join(_.getPath("userData"), "chatlog-server.log");
    return D.existsSync(e) ? (await st.showItemInFolder(e), { ok: !0 }) : { ok: !1, error: "日志文件不存在" };
  } catch (e) {
    return { ok: !1, error: (e == null ? void 0 : e.message) || String(e) };
  }
});
S.handle("logs:clear", async () => {
  try {
    const e = s.join(_.getPath("userData"), "chatlog-server.log");
    return D.existsSync(e) && D.truncateSync(e, 0), { ok: !0 };
  } catch (e) {
    return { ok: !1, error: (e == null ? void 0 : e.message) || String(e) };
  }
});
S.handle("summarize:day", async (e, t) => {
  var r;
  try {
    const n = String((t == null ? void 0 : t.date) || "").trim(), d = String((t == null ? void 0 : t.talker) || "").trim(), P = String((t == null ? void 0 : t.talkers) || "").trim(), h = [d, ...P.split(",").map((u) => u.trim()).filter(Boolean)].filter(Boolean).join(",");
    if (!n) return { ok: !1, error: "必须选择日期" };
    if (!h) return { ok: !1, error: "请至少填写一个聊天对象" };
    const R = `http://${i.addr || process.env.CHATLOG_HTTP_ADDR || "127.0.0.1:5030"}`, j = (t == null ? void 0 : t.requestId) || `${Date.now()}-${Math.random().toString(36).slice(2)}`, C = h.split(",").map((u) => u.trim()).filter(Boolean), f = (u) => {
      try {
        e.sender.send("summarize:progress", { requestId: j, content: u });
      } catch {
      }
    }, x = (u, p, $, g) => {
      try {
        e.sender.send("summarize:group", { requestId: j, index: u, total: p, talker: $, name: g });
      } catch {
      }
    };
    for (let u = 0; u < C.length; u++) {
      const p = C[u], $ = `${R}/api/v1/chatlog?format=json&time=${encodeURIComponent(n)}&talker=${encodeURIComponent(p)}`, g = await fetch($);
      if (!g.ok) return { ok: !1, error: `获取聊天记录失败：${g.status} ${g.statusText}` };
      const o = await g.json(), c = ((r = o == null ? void 0 : o[0]) == null ? void 0 : r.talkerName) || p;
      x(u + 1, C.length, p, c), f(`

## 群：${c}

`);
      const H = [];
      for (const T of o) {
        const B = T.time ? new Date(T.time).toLocaleString() : "", y = T.talkerName || T.talker || "", b = T.senderName || T.sender || "", a = (T.content || "").replace(/\s+/g, " ").trim(), E = y ? `[${y}] ` : "";
        H.push(`${B} ${E}${b}: ${a}`.trim());
      }
      const et = H.join(`
`), rt = JSON.stringify({ prompt: (t == null ? void 0 : t.prompt) || "", message: et }), M = await fetch("https://n8n-preview.beqlee.icu/webhook/b2199135-477f-4fab-b45e-dfd21ef1f86b", { method: "POST", headers: { "Content-Type": "application/json" }, body: rt }), W = M.body;
      if (W && typeof W.getReader == "function") {
        const T = W.getReader(), B = new TextDecoder();
        let y = "";
        for (; ; ) {
          const { value: a, done: E } = await T.read();
          if (E) break;
          y += B.decode(a, { stream: !0 });
          let N;
          for (; (N = y.indexOf(`
`)) >= 0; ) {
            const nt = y.slice(0, N);
            y = y.slice(N + 1);
            const F = nt.trim();
            if (F)
              try {
                const O = JSON.parse(F);
                if ((O == null ? void 0 : O.type) === "item") {
                  const A = O == null ? void 0 : O.content;
                  typeof A == "string" && A && A !== "undefined" && f(A);
                }
              } catch {
                f(F);
              }
          }
        }
        const b = y.trim();
        if (b)
          try {
            const a = JSON.parse(b);
            (a == null ? void 0 : a.type) === "item" && typeof (a == null ? void 0 : a.content) == "string" && f(a.content);
          } catch {
            f(b);
          }
      } else {
        const B = (await M.text()).split(/\r?\n/);
        for (const y of B) {
          const b = y.trim();
          if (b)
            try {
              const a = JSON.parse(b);
              (a == null ? void 0 : a.type) === "item" && typeof (a == null ? void 0 : a.content) == "string" && a.content !== "undefined" && f(a.content);
            } catch {
              f(b);
            }
        }
      }
    }
    return { ok: !0, status: 200 };
  } catch (n) {
    return { ok: !1, error: (n == null ? void 0 : n.message) || String(n) };
  }
});
export {
  St as MAIN_DIST,
  z as RENDERER_DIST,
  L as VITE_DEV_SERVER_URL
};

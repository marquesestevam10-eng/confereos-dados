/* Cadastro de Redes — site. Serve o app (pasta app/) direto do repositório PRIVADO triagemos-dados,
   com a chave aberta pela senha do login. Nada do cadastro fica público no GitHub Pages. */
const VERSAO = "cad-1";                       // subir quando mudar arquivos de dados (cadastro/www)
const REPO = "marquesestevam10-eng/triagemos-dados";
const TIPOS = { html: "text/html; charset=utf-8", js: "text/javascript", json: "application/json", txt: "text/plain; charset=utf-8", jpg: "image/jpeg", png: "image/png", mp4: "video/mp4", pdf: "application/pdf" };
let TOK = null;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith("cad-") && k !== VERSAO && k !== "cad-blobs") await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener("message", e => { if (e.data && "tok" in e.data) { TOK = e.data.tok; idb("set", e.data.tok); if (!e.data.tok) caches.delete(VERSAO); } });

function idb(op, v) {
  return new Promise(res => {
    const r = indexedDB.open("cadsite", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("k");
    r.onsuccess = () => { const t = r.result.transaction("k", op === "set" ? "readwrite" : "readonly").objectStore("k");
      const q = op === "set" ? t.put(v, "tok") : t.get("tok"); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); };
    r.onerror = () => res(null);
  });
}

self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  const base = new URL("app/", self.registration.scope);
  if (u.origin !== base.origin || !u.pathname.startsWith(base.pathname)) return;
  let rel = decodeURIComponent(u.pathname.slice(base.pathname.length));
  e.respondWith(servir(rel));
});

async function servir(rel) {
  if (!TOK) TOK = await idb("get");
  if (!TOK) return Response.redirect(self.registration.scope, 302);
  let caminho, cacheNome = VERSAO, rede = false;
  if (rel === "" || rel === "index.html") { caminho = "cadastro/ui/app.html"; rel = "index.html"; rede = true; }
  else if (rel.startsWith("_blob/")) { caminho = "cadastro/blobs/" + rel.slice(6).replace(/[^A-Za-z0-9_-]/g, "") + ".jpg"; cacheNome = "cad-blobs"; }
  else caminho = "cadastro/www/" + rel;
  const chave = self.registration.scope + "app/" + rel;
  const cache = await caches.open(cacheNome);
  if (!rede) { const c = await cache.match(chave); if (c) return c; }
  try {
    const r = await fetch("https://api.github.com/repos/" + REPO + "/contents/" + caminho.split("/").map(encodeURIComponent).join("/") + (rede ? "?t=" + Date.now() : ""),
      { headers: { Authorization: "token " + TOK, Accept: "application/vnd.github.raw" }, cache: "no-store" });
    if (r.status === 401) { TOK = null; await idb("set", null); return Response.redirect(self.registration.scope + "?sair=1", 302); }
    if (!r.ok) return new Response("não encontrado", { status: 404 });
    const ext = (rel.split(".").pop() || "").toLowerCase();
    const resp = new Response(await r.blob(), { status: 200, headers: { "Content-Type": rel.startsWith("_blob/") ? "image/jpeg" : (TIPOS[ext] || "application/octet-stream") } });
    await cache.put(chave, resp.clone());
    return resp;
  } catch (err) {
    const c = await cache.match(chave); if (c) return c;      // sem internet: o que já foi aberto antes
    return new Response("sem internet", { status: 503 });
  }
}

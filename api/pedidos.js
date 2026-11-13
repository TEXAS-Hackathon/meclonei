import { get, list } from "@vercel/blob";
import { esc, isAdmin, pacoteLabel } from "./_lib.js";

// Painel simples: /api/pedidos?chave=SUA_ADMIN_KEY
export async function GET(request) {
  if (!isAdmin(request)) return new Response("Acesso negado.", { status: 401 });
  const chave = encodeURIComponent(new URL(request.url).searchParams.get("chave"));

  const blobs = [];
  let cursor;
  do {
    const page = await list({ prefix: "pedidos/", cursor, limit: 1000 });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

  // shortcut: lê no máximo os 100 pedidos mais recentes; paginar quando passar disso
  const pedidos = await Promise.all(blobs.slice(0, 100).map(async b => {
    try {
      const r = await get(b.pathname, { access: "private" });
      return JSON.parse(await new Response(r.stream).text());
    } catch { return null; }
  }));

  const file = p => `/api/arquivo?chave=${chave}&p=${encodeURIComponent(p)}`;
  const fmt = iso => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const cards = pedidos.filter(Boolean).map(p => `
    <article>
      <header><b>${esc(p.nome)}</b> · ${esc(pacoteLabel(p.pacote))} · <small>${esc(fmt(p.recebidoEm))}</small></header>
      <div class="cols">
        <div>
          <p><a href="https://wa.me/${esc(p.whatsapp)}" target="_blank">WhatsApp ${esc(p.whatsapp)}</a> · ${esc(p.email)}</p>
          <p><b>Pedido Kiwify:</b> ${esc(p.pedido) || "—"}</p>
          <p><b>Produto:</b> ${esc(p.produto)}</p>
          <p><b>O que faz:</b> ${esc(p.oQueFaz)}</p>
          <p><b>Benefício:</b> ${esc(p.beneficio)}</p>
          <p><b>Tom:</b> ${esc(p.tom)}</p>
          <p><b>Roteiro:</b> ${p.querRoteiro ? "<i>quer que a gente escreva</i>" : esc(p.roteiro).replace(/\n/g, "<br>")}</p>
          <p class="muted">Aceite: ${esc(fmt(p.aceite?.dataHora))} · IP ${esc(p.aceite?.ip)}</p>
        </div>
        <div>
          <a href="${file(p.selfie)}" target="_blank"><img src="${file(p.selfie)}" alt="selfie"></a>
          <audio controls preload="none" src="${file(p.audio)}"></audio>
          <p class="muted">Áudio: ~${Math.round(p.audioSegundos || 0)}s · <a href="${file(p.audio)}" download>baixar</a></p>
        </div>
      </div>
    </article>`).join("") || "<p>Nenhum pedido ainda.</p>";

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Pedidos — MeClonei</title><style>
body{font-family:system-ui,sans-serif;background:#F4F6FB;color:#101322;margin:0;padding:20px}
h1{font-size:22px}article{background:#fff;border:1px solid #dde2ee;border-radius:14px;padding:16px;margin:0 0 14px}
header{margin-bottom:10px}.cols{display:grid;grid-template-columns:1fr 220px;gap:16px}p{margin:4px 0}
img{width:100%;border-radius:10px}audio{width:100%;margin-top:8px}.muted{color:#4A5168;font-size:13px}a{color:#2E5BFF}
@media(max-width:640px){.cols{grid-template-columns:1fr}}</style></head><body>
<h1>Pedidos (${blobs.length})</h1>${cards}</body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

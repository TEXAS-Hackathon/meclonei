import { put } from "@vercel/blob";
import { json, normEmail, normPhone, pagoKeys, secretMatches } from "./_lib.js";

// Webhook da Kiwify (evento "Compra aprovada"):
// URL na Kiwify: https://www.meclonei.com.br/api/kiwify?chave=KIWIFY_WEBHOOK_SECRET
export async function POST(request) {
  const given = new URL(request.url).searchParams.get("chave");
  if (!secretMatches(given, process.env.KIWIFY_WEBHOOK_SECRET)) return json({ error: "Acesso negado." }, 401);

  let body;
  try { body = await request.json(); } catch { return json({ error: "JSON inválido." }, 400); }
  const status = String(body.order_status || "").toLowerCase();
  const evento = String(body.webhook_event_type || "").toLowerCase();
  if (status !== "paid" && evento !== "order_approved") return json({ ok: true, ignorado: status || evento || "sem status" });

  const c = body.Customer || body.customer || {};
  const email = normEmail(c.email), whatsapp = normPhone(c.mobile || c.phone);
  const registro = {
    pedido: String(body.order_id || body.order_ref || ""),
    produto: String(body.Product?.product_name || body.product_name || ""),
    nome: String(c.full_name || c.first_name || ""),
    email, whatsapp,
    aprovadoEm: String(body.approved_date || new Date().toISOString()),
  };
  const keys = pagoKeys(email, whatsapp);
  if (!keys.length) return json({ error: "Compra sem e-mail nem telefone." }, 400);
  await Promise.all(keys.map(k => put(k, JSON.stringify(registro), {
    access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true,
  })));
  return json({ ok: true });
}

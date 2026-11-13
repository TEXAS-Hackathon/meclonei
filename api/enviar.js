import { head, put } from "@vercel/blob";
import { CONSENT_TEXT, clientIp, json, notifyWhatsApp, pedidoMessage, validateEnvio } from "./_lib.js";

// Recebe o formulário do /enviar e grava o pedido (com o registro do aceite) no Blob privado
export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Envio inválido." }, 400); }

  const { data, error } = validateEnvio(body);
  if (error) return json({ error }, 400);

  try {
    // Confere se os arquivos existem mesmo no Blob antes de aceitar o pedido
    await head(data.selfie);
    await head(data.audio);
  } catch {
    return json({ error: "Não encontramos seus arquivos. Envie a selfie e o áudio de novo." }, 400);
  }

  const now = new Date();
  const pedido = {
    ...data,
    recebidoEm: now.toISOString(),
    aceite: {
      texto: CONSENT_TEXT,
      dataHora: now.toISOString(),
      ip: clientIp(request),
      userAgent: (request.headers.get("user-agent") || "").slice(0, 300),
    },
  };

  try {
    await put(`pedidos/${now.toISOString().replace(/[:.]/g, "-")}.json`, JSON.stringify(pedido, null, 2), {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: true,
    });
  } catch (e) {
    console.error("[enviar] falha ao salvar", e);
    return json({ error: "Não conseguimos salvar agora. Tente de novo em instantes." }, 500);
  }
  // Pedido já está salvo; se o aviso falhar, ele continua no painel /api/pedidos
  await notifyWhatsApp(pedidoMessage(pedido, new URL(request.url).origin));
  return json({ ok: true });
}

import { createHmac, timingSafeEqual } from "node:crypto";

// Limites de upload (o navegador também valida, mas quem manda é o servidor)
export const LIMITS = {
  selfie: { types: ["image/jpeg", "image/png"], maxBytes: 10 * 1024 * 1024 },
  audio: { types: ["audio/*"], maxBytes: 30 * 1024 * 1024 },
};

export const PACOTES = ["1", "5", "10", "10s", "20s", "30s"]; // 10s/20s/30s: compras antigas por duração
export const pacoteLabel = p => (/s$/.test(p) ? `Vídeo ${p}` : `${p} ${p === "1" ? "vídeo" : "vídeos"}`);
export const TONS = ["animado", "sério", "divertido"];
export const CONSENT_TEXT =
  "Declaro que a foto e a voz enviadas são minhas e autorizo o uso para criar meu clone em IA e os vídeos contratados.";

// "envios/selfie-..." ou "envios/audio-..." -> "selfie" | "audio" | null
export function uploadKind(pathname) {
  const m = /^envios\/(selfie|audio)-[\w.-]+$/.exec(pathname || "");
  return m ? m[1] : null;
}

export function clientIp(request) {
  const fwd = request.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0] : request.headers.get("x-real-ip") || "").trim() || "desconhecido";
}

// Chave do painel em ADMIN_KEY (variável de ambiente na Vercel)
export function isAdmin(request) {
  const expected = Buffer.from(process.env.ADMIN_KEY || "");
  const given = Buffer.from(new URL(request.url).searchParams.get("chave") || "");
  // compara em bytes: timingSafeEqual lança erro se os tamanhos diferem
  if (expected.length < 12 || given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}

// Link assinado para UM arquivo (pode ser encaminhado sem expor o painel inteiro)
export function signFile(pathname) {
  return createHmac("sha256", process.env.ADMIN_KEY || "").update(pathname).digest("hex").slice(0, 32);
}
export function hasFileSig(request, pathname) {
  const t = Buffer.from(new URL(request.url).searchParams.get("t") || "");
  const expected = Buffer.from(signFile(pathname));
  return (process.env.ADMIN_KEY || "").length >= 12 && t.length === expected.length && timingSafeEqual(t, expected);
}

// Avisa no WhatsApp do dono via CallMeBot (CALLMEBOT_PHONE + CALLMEBOT_APIKEY na Vercel)
export async function notifyWhatsApp(text) {
  const phone = process.env.CALLMEBOT_PHONE, apikey = process.env.CALLMEBOT_APIKEY;
  if (!phone || !apikey) return false;
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(apikey)}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) console.error("[whatsapp] CallMeBot respondeu", r.status);
    return r.ok;
  } catch (e) {
    console.error("[whatsapp] falha ao avisar", e.message);
    return false;
  }
}

export function pedidoMessage(p, origin) {
  const link = path => `${origin}/api/arquivo?p=${encodeURIComponent(path)}&t=${signFile(path)}`;
  const roteiro = p.querRoteiro ? "quer que a gente escreva" : p.roteiro.slice(0, 900);
  return [
    "🎬 *Novo pedido MeClonei*",
    "",
    `*Nome:* ${p.nome}`,
    `*WhatsApp:* https://wa.me/${p.whatsapp}`,
    `*E-mail:* ${p.email}`,
    `*Pedido Kiwify:* ${p.pedido || "—"}`,
    `*Pacote:* ${pacoteLabel(p.pacote)}`,
    "",
    `*Produto:* ${p.produto}`,
    `*O que faz:* ${p.oQueFaz}`,
    `*Benefício:* ${p.beneficio}`,
    `*Tom:* ${p.tom}`,
    `*Roteiro:* ${roteiro}`,
    "",
    `📷 Selfie: ${link(p.selfie)}`,
    `🎙️ Voz (~${Math.round(p.audioSegundos || 0)}s): ${link(p.audio)}`,
    "",
    `✅ Autorização aceita em ${new Date(p.aceite.dataHora).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
  ].join("\n");
}

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Valida e normaliza o envio do formulário. Retorna { data } ou { error }.
export function validateEnvio(body) {
  if (!body || typeof body !== "object") return { error: "Envio inválido." };
  const d = {
    nome: str(body.nome, 120),
    email: str(body.email, 160),
    whatsapp: str(body.whatsapp, 30).replace(/\D/g, ""),
    pedido: str(body.pedido, 80),
    pacote: str(body.pacote, 10),
    produto: str(body.produto, 120),
    oQueFaz: str(body.oQueFaz, 600),
    beneficio: str(body.beneficio, 400),
    roteiro: str(body.roteiro, 3000),
    querRoteiro: body.querRoteiro === true,
    tom: str(body.tom, 20),
    selfie: str(body.selfie, 300),
    audio: str(body.audio, 300),
    audioSegundos: Number(body.audioSegundos) || 0,
  };
  if (!d.nome) return { error: "Informe seu nome." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return { error: "E-mail inválido." };
  if (d.whatsapp.length < 10 || d.whatsapp.length > 13) return { error: "WhatsApp inválido. Use DDD + número." };
  if (d.whatsapp.length <= 11) d.whatsapp = "55" + d.whatsapp; // DDD + número -> padrão internacional
  if (!PACOTES.includes(d.pacote)) return { error: "Escolha o pacote." };
  if (!d.produto || !d.oQueFaz || !d.beneficio) return { error: "Preencha as informações do produto." };
  if (!d.querRoteiro && !d.roteiro) return { error: "Escreva o roteiro ou marque que quer que a gente escreva." };
  if (!TONS.includes(d.tom)) return { error: "Escolha o tom do vídeo." };
  if (uploadKind(d.selfie) !== "selfie") return { error: "Envie sua selfie." };
  if (uploadKind(d.audio) !== "audio") return { error: "Envie o áudio da sua voz." };
  if (body.aceite !== true) return { error: "É preciso aceitar a autorização de uso." };
  if (d.querRoteiro) d.roteiro = "";
  return { data: d };
}

export const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8" } });

export const esc = s =>
  String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

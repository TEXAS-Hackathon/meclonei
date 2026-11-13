import { timingSafeEqual } from "node:crypto";

// Limites de upload (o navegador também valida, mas quem manda é o servidor)
export const LIMITS = {
  selfie: { types: ["image/jpeg", "image/png"], maxBytes: 10 * 1024 * 1024 },
  audio: { types: ["audio/*"], maxBytes: 30 * 1024 * 1024 },
};

export const PACOTES = ["10s", "20s", "30s"];
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
  const expected = process.env.ADMIN_KEY || "";
  const given = new URL(request.url).searchParams.get("chave") || "";
  if (expected.length < 12 || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
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

import { get } from "@vercel/blob";
import { hasFileSig, isAdmin, uploadKind } from "./_lib.js";

// Entrega a selfie/áudio (privados) para quem tem a chave do painel ou o link assinado do arquivo.
// Suporta Range (206): iPhone/Safari/WhatsApp só tocam áudio assim. &download=1 força baixar.
async function serve(request, headOnly) {
  const params = new URL(request.url).searchParams;
  const p = params.get("p");
  if (!isAdmin(request) && !hasFileSig(request, p || "")) return new Response("Acesso negado.", { status: 401 });
  if (!uploadKind(p)) return new Response("Arquivo inválido.", { status: 400 });

  const result = await get(p, { access: "private" }).catch(() => null);
  if (!result || result.statusCode !== 200) return new Response("Não encontrado.", { status: 404 });
  // arquivos limitados a 30 MB no upload: cabe em memória e permite responder Range
  const buf = Buffer.from(await new Response(result.stream).arrayBuffer());
  const name = p.split("/").pop();
  const headers = {
    "content-type": result.blob.contentType,
    "accept-ranges": "bytes",
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
    "content-disposition": `${params.get("download") ? "attachment" : "inline"}; filename="${name}"`,
  };

  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") || "");
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : buf.length - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : buf.length - 1;
    start = Math.max(0, start); end = Math.min(end, buf.length - 1);
    if (start > end) return new Response(null, { status: 416, headers: { ...headers, "content-range": `bytes */${buf.length}` } });
    const part = buf.subarray(start, end + 1);
    return new Response(headOnly ? null : part, {
      status: 206,
      headers: { ...headers, "content-range": `bytes ${start}-${end}/${buf.length}`, "content-length": String(part.length) },
    });
  }
  return new Response(headOnly ? null : buf, { headers: { ...headers, "content-length": String(buf.length) } });
}

export const GET = request => serve(request, false);
export const HEAD = request => serve(request, true);

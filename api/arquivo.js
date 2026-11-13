import { get } from "@vercel/blob";
import { hasFileSig, isAdmin, uploadKind } from "./_lib.js";

// Entrega a selfie/áudio (privados) para quem tem a chave do painel ou o link assinado do arquivo
export async function GET(request) {
  const p = new URL(request.url).searchParams.get("p");
  if (!isAdmin(request) && !hasFileSig(request, p || "")) return new Response("Acesso negado.", { status: 401 });
  if (!uploadKind(p)) return new Response("Arquivo inválido.", { status: 400 });

  const result = await get(p, { access: "private" }).catch(() => null);
  if (!result || result.statusCode !== 200) return new Response("Não encontrado.", { status: 404 });
  return new Response(result.stream, {
    headers: {
      "content-type": result.blob.contentType,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-disposition": `inline; filename="${p.split("/").pop()}"`,
    },
  });
}

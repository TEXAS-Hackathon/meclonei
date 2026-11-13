import { get } from "@vercel/blob";
import { isAdmin, uploadKind } from "./_lib.js";

// Entrega a selfie/áudio (privados) só para quem tem a chave do painel
export async function GET(request) {
  if (!isAdmin(request)) return new Response("Acesso negado.", { status: 401 });
  const p = new URL(request.url).searchParams.get("p");
  if (!uploadKind(p)) return new Response("Arquivo inválido.", { status: 400 });

  const result = await get(p, { access: "private" }).catch(() => null);
  if (!result || result.statusCode !== 200) return new Response("Não encontrado.", { status: 404 });
  return new Response(result.stream, {
    headers: {
      "content-type": result.blob.contentType,
      "cache-control": "private, no-store",
      "content-disposition": `inline; filename="${p.split("/").pop()}"`,
    },
  });
}

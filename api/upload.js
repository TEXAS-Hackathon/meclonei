import { handleUpload } from "@vercel/blob/client";
import { LIMITS, json, uploadKind } from "./_lib.js";

// Gera o token para o navegador subir a selfie/áudio direto no Vercel Blob (privado)
export async function POST(request) {
  try {
    const body = await request.json();
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async pathname => {
        const kind = uploadKind(pathname);
        if (!kind) throw new Error("Arquivo inválido.");
        return {
          allowedContentTypes: LIMITS[kind].types,
          maximumSizeInBytes: LIMITS[kind].maxBytes,
          addRandomSuffix: true,
        };
      },
    });
    return json(result);
  } catch (e) {
    return json({ error: e.message || "Falha no upload." }, 400);
  }
}

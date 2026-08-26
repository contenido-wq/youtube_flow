// Nano Banana Pro (Gemini 3 Pro Image), llamado vía el endpoint clásico y
// estable de generateContent — la investigación de este spec encontró
// referencias a un endpoint más nuevo ("Interactions API",
// v1beta/interactions) en la documentación 2026 de Google, pero la forma
// exacta de su request/response no pudo confirmarse con certeza en la
// investigación. Este archivo usa generateContent porque es el patrón
// documentado más estable y de más larga data del API de Gemini — SI esto
// falla contra la API real una vez haya una GEMINI_API_KEY real configurada,
// es la primera pista a revisar: verificar contra
// https://ai.google.dev/gemini-api/docs/image-generation si Google movió
// la generación de imágenes exclusivamente al nuevo endpoint.
const MODEL_ID = 'gemini-3-pro-image'
const BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent`

export async function generateThumbnailImage(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  })

  const data = await response.json()

  if (data.error) {
    throw new Error(`Gemini image generation falló: ${data.error.message ?? JSON.stringify(data.error)}`)
  }

  const parts: { inlineData?: { data: string } }[] = data.candidates?.[0]?.content?.parts ?? []
  const imagePart = parts.find((p) => p.inlineData?.data)

  if (!imagePart?.inlineData?.data) {
    throw new Error('Gemini no devolvió una imagen en la respuesta')
  }

  return imagePart.inlineData.data
}

// Nano Banana Pro (Gemini 3 Pro Image) vía el endpoint clásico de
// generateContent — verificado contra la API real el 2026-08-26: responde
// 200 con un JPEG válido en candidates[0].content.parts[].inlineData.data.
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

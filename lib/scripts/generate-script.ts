import { CLAUDE_MODEL, extractText, type AnthropicMessagesClient } from '@/lib/llm/anthropic-client'

export interface GenerateScriptInput {
  topic: string
  channelNiche: string
  channelVariationRules: string
  targetLanguage: string
  targetCharacterCount: number
  style: 'estandar' | 'personalizado'
  referenceTranscript?: string
}

export interface GeneratedScript {
  scriptContent: string
  seoTitles: string[]
  seoDescription: string
  seoTags: string[]
  seoPinnedComment: string
  seoThumbnailPhrases: string[]
  seoImagePrompts: string[]
}

export async function generateScript(
  client: AnthropicMessagesClient,
  input: GenerateScriptInput
): Promise<GeneratedScript> {
  const styleInstruction =
    input.style === 'personalizado' && input.referenceTranscript
      ? `Estilo personalizado: analiza el patrón estructural y narrativo (ritmo, tipo de apertura, forma de cerrar ideas) de esta transcripción de referencia y replica ESE PATRÓN — nunca copies su texto literal:\n\n"""${input.referenceTranscript}"""`
      : 'Estilo estándar: usa una estructura de hook (0-15s) + payoff cada 60-90s + CTA final.'

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    // Non-streaming: 16000 es el techo recomendado para no pegarle a timeouts
    // HTTP. effort "medium" baja cuánto "piensa" el modelo antes de escribir
    // — con effort por defecto (thinking adaptativo sin acotar), el guion
    // más el paquete SEO ampliado (10 títulos + 4 prompts de imagen) se
    // truncaba incluso con max_tokens en 16000.
    max_tokens: 16000,
    output_config: { effort: 'medium' },
    system:
      'Eres un guionista para un canal de YouTube faceless. Escribes en el idioma indicado, respetando ' +
      'las reglas de variación del canal para evitar contenido templado sin variación creativa (riesgo de ' +
      'penalización por "Inauthentic Content"). Apunta al conteo de caracteres indicado — es mejor pasarte ' +
      'un poco que quedarte corto, prioriza siempre un cierre lógico del guion sobre cortar en seco al llegar ' +
      'al número exacto.\n\n' +
      'Además del guion, generas el paquete completo de SEO y creativos: ' +
      'seoTitles — exactamente 10 títulos alternativos llamativos para el video (variá el ángulo: curiosidad, ' +
      'beneficio directo, controversia, storytelling), cada uno una oración corta lista para publicar. ' +
      'seoImagePrompts — exactamente 4 prompts de imagen para miniatura, cada uno un enfoque visual distinto ' +
      '(1: close-up dramático de un rostro/personaje con expresión intensa; 2: escena amplia/panorámica del ' +
      'entorno del tema; 3: composición conceptual/artística que representa la idea central; 4: escena ' +
      'dinámica/de acción), cada prompt como una sola oración con: la escena descrita, el texto exacto en ' +
      'MAYÚSCULAS a incluir entre comillas, su posición (ej. centered, bottom-center, top-right), fuente ' +
      'sugerida, color y estilo/acabado.\n\n' +
      'Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, con el formato: ' +
      '{"scriptContent": string, "seoTitles": string[10], "seoDescription": string, "seoTags": string[], ' +
      '"seoPinnedComment": string, "seoThumbnailPhrases": string[], "seoImagePrompts": string[4]}',
    messages: [
      {
        role: 'user',
        content:
          `Tema: ${input.topic}\n` +
          `Nicho del canal: ${input.channelNiche}\n` +
          `Idioma de salida: ${input.targetLanguage}\n` +
          `Conteo de caracteres objetivo: ${input.targetCharacterCount}\n` +
          `Reglas de variación obligatoria: ${input.channelVariationRules}\n\n` +
          `${styleInstruction}`,
      },
    ],
  })

  const text = extractText(response.content)

  try {
    return JSON.parse(text) as GeneratedScript
  } catch {
    throw new Error(`Claude no devolvió JSON válido para el guion: ${text.slice(0, 200)}`)
  }
}

import Anthropic from '@anthropic-ai/sdk'

// Modelo por defecto vigente (ver skill de Claude API) — cambiarlo aquí
// afecta a todo el pipeline de generación (clonación + títulos).
export const CLAUDE_MODEL = 'claude-opus-5'

// Forma mínima que necesitan los generadores — permite inyectar un cliente
// falso en tests sin depender de los tipos completos (y sobrecargados) del
// SDK real. `Anthropic` real es estructuralmente compatible con esto.
export type AnthropicMessagesClient = {
  messages: {
    // Sintaxis de método (no propiedad con tipo función): TypeScript la
    // chequea de forma bivariante, así que el cliente real del SDK (cuyo
    // `create` espera un tipo de parámetro más específico que `unknown`)
    // sigue siendo asignable aquí. Con `create: (params: unknown) => ...`
    // como propiedad, el chequeo contravariante estricto lo rechazaría.
    create(params: unknown): Promise<{ content: { type: string; text?: string }[] }>
  }
}

export function createAnthropicClient(): AnthropicMessagesClient {
  return new Anthropic()
}

export function extractText(content: { type: string; text?: string }[]): string {
  const textBlock = content.find((block) => block.type === 'text')
  return textBlock?.text ?? ''
}

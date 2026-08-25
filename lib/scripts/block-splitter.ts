// Divide en oraciones conservando el delimitador (. ! ?) al final de cada una.
const SENTENCE_REGEX = /[^.!?]+[.!?]+(?:\s+|$)/g

export function splitIntoCoherentBlocks(text: string, targetBlockSize: number): string[] {
  const trimmed = text.trim()
  if (trimmed.length === 0) return []

  const sentences = (trimmed.match(SENTENCE_REGEX) ?? [trimmed]).map((s) => s.trim())

  const blocks: string[] = []
  let current = ''

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence

    // Si agregar esta oración se pasa del objetivo Y ya hay contenido
    // acumulado, cierra el bloque actual antes de agregarla — nunca corta
    // una oración a la mitad para "ajustar" al tamaño exacto.
    if (current && candidate.length > targetBlockSize) {
      blocks.push(current)
      current = sentence
    } else {
      current = candidate
    }
  }

  if (current) blocks.push(current)

  return blocks
}

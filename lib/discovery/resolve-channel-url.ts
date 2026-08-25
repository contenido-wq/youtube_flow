const BASE_URL = 'https://www.googleapis.com/youtube/v3'

export interface ResolvedChannel {
  channelId: string
  title: string
}

type ParsedRef =
  | { type: 'id'; value: string }
  | { type: 'handle'; value: string }
  | { type: 'username'; value: string }

function parseYoutubeChannelRef(input: string): ParsedRef | null {
  const trimmed = input.trim()
  if (trimmed.length === 0) return null

  // @handle pegado suelto, sin URL completa.
  if (trimmed.startsWith('@')) return { type: 'handle', value: trimmed }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(trimmed)
  } catch {
    return null
  }

  if (!parsedUrl.hostname.includes('youtube.com') && !parsedUrl.hostname.includes('youtu.be')) return null

  const segments = parsedUrl.pathname.split('/').filter(Boolean)
  if (segments.length === 0) return null

  if (segments[0] === 'channel' && segments[1]) return { type: 'id', value: segments[1] }
  if (segments[0].startsWith('@')) return { type: 'handle', value: segments[0] }
  if (segments[0] === 'c' && segments[1]) return { type: 'handle', value: `@${segments[1]}` }
  if (segments[0] === 'user' && segments[1]) return { type: 'username', value: segments[1] }

  return null
}

async function lookupChannel(ref: ParsedRef, apiKey: string): Promise<ResolvedChannel | null> {
  const url = new URL(`${BASE_URL}/channels`)
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('key', apiKey)
  if (ref.type === 'id') url.searchParams.set('id', ref.value)
  else if (ref.type === 'handle') url.searchParams.set('forHandle', ref.value)
  else url.searchParams.set('forUsername', ref.value)

  const response = await fetch(url.toString())
  const data = await response.json()
  const item = data.items?.[0]
  if (!item) return null

  return { channelId: item.id, title: item.snippet.title }
}

async function searchChannelByName(name: string, apiKey: string): Promise<ResolvedChannel | null> {
  const url = new URL(`${BASE_URL}/search`)
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('type', 'channel')
  url.searchParams.set('q', name)
  url.searchParams.set('maxResults', '1')
  url.searchParams.set('key', apiKey)

  const response = await fetch(url.toString())
  const data = await response.json()
  const item = data.items?.[0]
  if (!item) return null

  return { channelId: item.id.channelId, title: item.snippet.title }
}

export async function resolveChannelFromUrl(apiKey: string, input: string): Promise<ResolvedChannel | null> {
  const ref = parseYoutubeChannelRef(input)
  if (!ref) return null

  const direct = await lookupChannel(ref, apiKey)
  if (direct) return direct

  // El lookup directo (id/forHandle/forUsername) no encontró nada — puede
  // pasar con URLs /c/ personalizadas cuyo slug no coincide con el @handle
  // real. Como último recurso, se busca por el nombre extraído de la URL.
  const searchTerm = ref.value.replace(/^@/, '')
  return searchChannelByName(searchTerm, apiKey)
}

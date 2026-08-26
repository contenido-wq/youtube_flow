const BASE_URL = 'https://www.googleapis.com/youtube/v3'

export interface ChannelDetails {
  description: string
  country: string | undefined
  defaultLanguage: string | undefined
}

export async function fetchChannelDetails(apiKey: string, channelId: string): Promise<ChannelDetails> {
  const url = new URL(`${BASE_URL}/channels`)
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('id', channelId)
  url.searchParams.set('key', apiKey)

  const response = await fetch(url.toString())
  const data = await response.json()

  if (data.error) {
    throw new Error(`channels.list falló: ${data.error.message ?? JSON.stringify(data.error)}`)
  }

  const snippet = data.items?.[0]?.snippet

  return {
    description: snippet?.description ?? '',
    country: snippet?.country,
    defaultLanguage: snippet?.defaultLanguage,
  }
}

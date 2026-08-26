export type NewsCategory = 'oficial' | 'competencia' | 'canales_nuevos' | 'recomendacion'

export interface NewsItemRow {
  id: string
  category: NewsCategory
  title: string
  summary: string
  source_url: string | null
  source_channel_youtube_id: string | null
  created_at: string
}

export interface OfficialUpdate {
  channelName: string
  videoId: string
  title: string
  description: string
  publishedAt: string
}

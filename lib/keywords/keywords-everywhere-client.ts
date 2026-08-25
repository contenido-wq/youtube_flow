export interface KeywordData {
  keyword: string
  volume: number
  cpc: number
  competition: number
}

export async function getKeywordData(apiKey: string, keywords: string[]): Promise<KeywordData[]> {
  const body = new URLSearchParams()
  keywords.forEach((k) => body.append('kw[]', k))
  body.append('country', 'us')
  body.append('currency', 'USD')
  body.append('dataSource', 'gkp')

  const response = await fetch('https://api.keywordseverywhere.com/v1/get_keyword_data', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  const data = await response.json()

  return (data.data ?? []).map((item: { keyword: string; vol: number; cpc: { value: string }; competition: number }) => ({
    keyword: item.keyword,
    volume: item.vol,
    cpc: Number(item.cpc.value),
    competition: item.competition,
  }))
}

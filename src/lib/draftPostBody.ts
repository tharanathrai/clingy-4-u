export function buildDraftPostBody(params: {
  creatorName: string
  recipientName: string
  title: string
  category: string
}): string {
  const cleanedTitle = params.title.trim().replace(/[.!?]+$/g, '')
  const names = `${params.creatorName} and ${params.recipientName}`

  if (params.category === 'active') return `${names} went ${cleanedTitle}.`
  if (params.category === 'savor') return `${names} shared ${cleanedTitle}.`
  if (params.category === 'intimate') return `${names} had ${cleanedTitle}.`
  if (params.category === 'explore') return `${names} explored ${cleanedTitle}.`
  if (params.category === 'recharge') return `${names} did ${cleanedTitle}.`
  if (params.category === 'playful') return `${names} made ${cleanedTitle}.`
  if (params.category === 'support') return `${names} showed up for ${cleanedTitle}.`

  return `${names}: ${cleanedTitle}.`
}

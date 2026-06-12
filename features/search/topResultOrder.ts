export type TopResultSection = 'places' | 'posts' | 'people'

export function getTopResultSectionOrder(dishFirstTopResults: boolean): TopResultSection[] {
  return dishFirstTopResults ? ['posts', 'places', 'people'] : ['places', 'posts', 'people']
}

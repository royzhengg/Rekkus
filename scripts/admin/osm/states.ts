export interface StateBbox {
  code: string
  name: string
  south: number
  west: number
  north: number
  east: number
  capital: string // fallback city when addr:city is missing
}

export const AU_STATES: StateBbox[] = [
  { code: 'NSW', name: 'New South Wales',    south: -37.50, west: 140.90, north: -28.10, east: 153.60, capital: 'Sydney' },
  { code: 'VIC', name: 'Victoria',           south: -39.20, west: 140.90, north: -33.90, east: 150.00, capital: 'Melbourne' },
  { code: 'QLD', name: 'Queensland',         south: -29.20, west: 137.90, north:  -9.90, east: 153.60, capital: 'Brisbane' },
  { code: 'SA',  name: 'South Australia',    south: -38.10, west: 129.00, north: -25.90, east: 141.00, capital: 'Adelaide' },
  { code: 'WA',  name: 'Western Australia',  south: -35.10, west: 112.90, north: -13.70, east: 129.00, capital: 'Perth' },
  { code: 'TAS', name: 'Tasmania',           south: -43.70, west: 143.80, north: -39.50, east: 148.50, capital: 'Hobart' },
  { code: 'NT',  name: 'Northern Territory', south: -26.00, west: 128.90, north: -10.90, east: 138.00, capital: 'Darwin' },
  { code: 'ACT', name: 'Australian Capital Territory', south: -35.90, west: 148.70, north: -35.10, east: 149.40, capital: 'Canberra' },
]

export const VENUE_FILTERS = [
  'amenity~"restaurant|cafe|bar|pub|fast_food|ice_cream|food_court"',
  'shop~"bakery|coffee|deli|confectionery|pastry"',
]

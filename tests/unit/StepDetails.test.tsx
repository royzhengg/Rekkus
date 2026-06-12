import { fireEvent, render } from '@testing-library/react-native'
import { type ComponentProps, useState } from 'react'
import StepDetails from '@/components/post-create/StepDetails'
import type { RekkusOccasionTag, RekkusTasteVerdict, RekkusValueVerdict } from '@/types/domain'

jest.mock('@/lib/contexts/ThemeContext', () => {
  const { lightColors } = jest.requireActual('@/constants/Colors')
  return { useThemeColors: () => lightColors }
})

jest.mock('@/lib/featureFlags', () => ({
  isEnabled: () => true,
}))

jest.mock('@/lib/analytics', () => ({
  analytics: { rekkusPickSelected: jest.fn() },
}))

jest.mock('@/components/ui/RekkusActionSheet', () => ({
  RekkusActionSheet: ({
    visible,
    onSelect,
  }: {
    visible: boolean
    onSelect: (value: string) => void
  }) => {
    const { Pressable, Text } = jest.requireActual('react-native')
    return visible ? (
      <Pressable accessibilityLabel="Select Japanese cuisine" onPress={() => onSelect('Japanese')}>
        <Text>Select Japanese cuisine</Text>
      </Pressable>
    ) : null
  },
}))

type HarnessProps = {
  initialCuisine?: string
  initialHashtags?: string[]
  initialMustOrder?: string
}

function Harness({ initialCuisine = '', initialHashtags = [], initialMustOrder = '' }: HarnessProps) {
  const [tasteVerdict, setTasteVerdict] = useState<RekkusTasteVerdict | undefined>()
  const [valueVerdict, setValueVerdict] = useState<RekkusValueVerdict | undefined>()
  const [occasionTags, setOccasionTags] = useState<RekkusOccasionTag[]>([])
  const [body, setBody] = useState('')
  const [cuisineType, setCuisineType] = useState(initialCuisine)
  const [hashtags, setHashtags] = useState(initialHashtags)
  const [hashtagInput, setHashtagInput] = useState('')
  const [mustOrder, setMustOrder] = useState(initialMustOrder)

  return (
    <StepDetails
      foodRating={0}
      setFoodRating={jest.fn()}
      vibeRating={0}
      setVibeRating={jest.fn()}
      costRating={0}
      setCostRating={jest.fn()}
      tasteVerdict={tasteVerdict}
      setTasteVerdict={setTasteVerdict}
      valueVerdict={valueVerdict}
      setValueVerdict={setValueVerdict}
      occasionTags={occasionTags}
      setOccasionTags={setOccasionTags}
      body={body}
      setBody={setBody}
      cuisineType={cuisineType}
      setCuisineType={setCuisineType}
      hashtags={hashtags}
      setHashtags={setHashtags}
      hashtagInput={hashtagInput}
      setHashtagInput={setHashtagInput}
      mustOrder={mustOrder}
      setMustOrder={setMustOrder}
      dishTags={[]}
    />
  )
}

function props(overrides: Partial<ComponentProps<typeof StepDetails>> = {}) {
  return {
    foodRating: 0,
    setFoodRating: jest.fn(),
    vibeRating: 0,
    setVibeRating: jest.fn(),
    costRating: 0,
    setCostRating: jest.fn(),
    tasteVerdict: undefined,
    setTasteVerdict: jest.fn(),
    valueVerdict: undefined,
    setValueVerdict: jest.fn(),
    occasionTags: [],
    setOccasionTags: jest.fn(),
    body: '',
    setBody: jest.fn(),
    cuisineType: '',
    setCuisineType: jest.fn(),
    hashtags: [],
    setHashtags: jest.fn(),
    hashtagInput: '',
    setHashtagInput: jest.fn(),
    mustOrder: '',
    setMustOrder: jest.fn(),
    dishTags: [],
    ...overrides,
  }
}

describe('StepDetails', () => {
  test('shows all sections including optional which is always visible', () => {
    const screen = render(<Harness />)

    expect(screen.getByText('Rekkus Picks')).toBeTruthy()
    expect(screen.getByText('Your Take')).toBeTruthy()
    expect(screen.getByText('Best Dish')).toBeTruthy()
    expect(screen.getByText('Optional')).toBeTruthy()
    // Optional section is always expanded — Cuisine visible without any tap
    expect(screen.getByText('Cuisine')).toBeTruthy()
  })

  test('keeps pick mappings — taste and value require switching tabs first', () => {
    const callbacks = props({ occasionTags: ['quick_bite', 'solo', 'casual'] })
    const screen = render(<StepDetails {...callbacks} />)

    // Taste tab is default — Craveable is visible
    fireEvent.press(screen.getByText('Craveable'))
    expect(callbacks.setTasteVerdict).toHaveBeenCalledWith('craveable')
    expect(callbacks.setFoodRating).toHaveBeenCalledWith(3)

    // Switch to Value tab
    fireEvent.press(screen.getByText('Value'))
    fireEvent.press(screen.getByText('Great value'))
    expect(callbacks.setValueVerdict).toHaveBeenCalledWith('great_value')
    expect(callbacks.setCostRating).toHaveBeenCalledWith(1)

    // Switch to Occasion tab — 3 already selected, adding Special drops oldest
    fireEvent.press(screen.getByText('Occasion'))
    fireEvent.press(screen.getByText('Special'))
    expect(callbacks.setOccasionTags).toHaveBeenCalledWith(['quick_bite', 'solo', 'casual'])
  })

  test('shows cuisine and tags when pre-populated, tags render without # prefix', () => {
    const screen = render(<Harness initialCuisine="Japanese" initialHashtags={['ramen']} />)

    expect(screen.getByText('Cuisine')).toBeTruthy()
    // Tags render without # prefix
    expect(screen.getByText('ramen')).toBeTruthy()

    fireEvent.press(screen.getByLabelText('Remove tag ramen'))
    expect(screen.queryByText('ramen')).toBeNull()
  })

  test('supports optional cuisine selection', () => {
    const screen = render(<Harness />)
    // Optional section always visible — no need to expand
    fireEvent.press(screen.getByLabelText('Select cuisine'))
    fireEvent.press(screen.getByLabelText('Select Japanese cuisine'))
    expect(screen.getByText('Japanese')).toBeTruthy()
  })

  test('adds and removes a tag from the optional details panel', () => {
    const screen = render(<Harness />)

    fireEvent.press(screen.getByLabelText('Add tag'))
    const tagInput = screen.getByPlaceholderText('e.g. surryhills, ramen')
    fireEvent.changeText(tagInput, 'ramen')
    fireEvent(tagInput, 'onSubmitEditing')

    expect(screen.getByText('ramen')).toBeTruthy()
    fireEvent.press(screen.getByLabelText('Remove tag ramen'))
    expect(screen.queryByText('ramen')).toBeNull()
  })
})

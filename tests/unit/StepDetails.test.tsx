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
}

function Harness({ initialCuisine = '', initialHashtags = [] }: HarnessProps) {
  const [tasteVerdict, setTasteVerdict] = useState<RekkusTasteVerdict | undefined>()
  const [valueVerdict, setValueVerdict] = useState<RekkusValueVerdict | undefined>()
  const [occasionTags, setOccasionTags] = useState<RekkusOccasionTag[]>([])
  const [body, setBody] = useState('')
  const [bestDish, setBestDish] = useState('')
  const [cuisineType, setCuisineType] = useState(initialCuisine)
  const [hashtags, setHashtags] = useState(initialHashtags)
  const [hashtagInput, setHashtagInput] = useState('')

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
      bestDish={bestDish}
      setBestDish={setBestDish}
      cuisineType={cuisineType}
      setCuisineType={setCuisineType}
      hashtags={hashtags}
      setHashtags={setHashtags}
      hashtagInput={hashtagInput}
      setHashtagInput={setHashtagInput}
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
    bestDish: '',
    setBestDish: jest.fn(),
    cuisineType: '',
    setCuisineType: jest.fn(),
    hashtags: [],
    setHashtags: jest.fn(),
    hashtagInput: '',
    setHashtagInput: jest.fn(),
    ...overrides,
  }
}

describe('StepDetails', () => {
  test('shows core review inputs while optional details start collapsed when blank', () => {
    const screen = render(<Harness />)

    expect(screen.getByText('Rekkus Picks')).toBeTruthy()
    expect(screen.getByText('Your review')).toBeTruthy()
    expect(screen.getByText('Best dish')).toBeTruthy()
    expect(screen.getByLabelText('Add optional details')).toBeTruthy()
    expect(screen.queryByText('Cuisine')).toBeNull()
  })

  test('keeps pick mappings and the occasion selection cap', () => {
    const callbacks = props({ occasionTags: ['quick_bite', 'solo', 'casual'] })
    const screen = render(<StepDetails {...callbacks} />)

    fireEvent.press(screen.getByText('Craveable'))
    fireEvent.press(screen.getByText('Great value'))
    fireEvent.press(screen.getByText('Special'))

    expect(callbacks.setTasteVerdict).toHaveBeenCalledWith('craveable')
    expect(callbacks.setFoodRating).toHaveBeenCalledWith(3)
    expect(callbacks.setValueVerdict).toHaveBeenCalledWith('great_value')
    expect(callbacks.setCostRating).toHaveBeenCalledWith(1)
    expect(callbacks.setOccasionTags).toHaveBeenCalledWith(['quick_bite', 'solo', 'casual'])
  })

  test('opens existing optional metadata, summarises it when collapsed, and restores editing', () => {
    const screen = render(<Harness initialCuisine="Japanese" initialHashtags={['ramen']} />)

    expect(screen.getByText('Cuisine')).toBeTruthy()
    expect(screen.getByText('#ramen')).toBeTruthy()

    fireEvent.press(screen.getByLabelText('Hide optional details'))
    expect(screen.getByText('Japanese · 1 tag')).toBeTruthy()
    expect(screen.queryByText('#ramen')).toBeNull()

    fireEvent.press(screen.getByLabelText('Add optional details'))
    expect(screen.getByText('#ramen')).toBeTruthy()
    fireEvent.press(screen.getByLabelText('Remove tag ramen'))
    expect(screen.queryByText('#ramen')).toBeNull()
  })

  test('supports optional cuisine and tags while preserving best-dish length limiting', () => {
    const bestDishSetter = jest.fn()
    const coreScreen = render(<StepDetails {...props({ setBestDish: bestDishSetter })} />)

    fireEvent.changeText(coreScreen.getByPlaceholderText('e.g. tonkotsu ramen'), 'x'.repeat(65))
    expect(bestDishSetter).toHaveBeenCalledWith('x'.repeat(60))

    const screen = render(<Harness />)
    fireEvent.press(screen.getByLabelText('Add optional details'))
    fireEvent.press(screen.getByLabelText('Select cuisine'))
    fireEvent.press(screen.getByLabelText('Select Japanese cuisine'))
    expect(screen.getByText('Japanese')).toBeTruthy()
  })

  test('adds and removes a tag from the optional details panel', () => {
    const screen = render(<Harness />)
    fireEvent.press(screen.getByLabelText('Add optional details'))

    const tagInput = screen.getByPlaceholderText('e.g. surryhills, ramen')
    fireEvent.changeText(tagInput, 'ramen')
    fireEvent(tagInput, 'onSubmitEditing')

    expect(screen.getByText('#ramen')).toBeTruthy()
    fireEvent.press(screen.getByLabelText('Remove tag ramen'))
    expect(screen.queryByText('#ramen')).toBeNull()
  })
})

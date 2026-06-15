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

function makeProps(overrides: Partial<ComponentProps<typeof StepDetails>> = {}): ComponentProps<typeof StepDetails> {
  return {
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
    cashDiscount: false,
    setCashDiscount: jest.fn(),
    googleReviewFreebie: false,
    setGoogleReviewFreebie: jest.fn(),
    dishTags: [],
    ...overrides,
  }
}

function Harness({ initialCuisine = '', initialHashtags = [] as string[], initialMustOrder = '' }: { initialCuisine?: string; initialHashtags?: string[]; initialMustOrder?: string } = {}) {
  const [tasteVerdict, setTasteVerdict] = useState<RekkusTasteVerdict | undefined>()
  const [valueVerdict, setValueVerdict] = useState<RekkusValueVerdict | undefined>()
  const [occasionTags, setOccasionTags] = useState<RekkusOccasionTag[]>([])
  const [body, setBody] = useState('')
  const [cuisineType, setCuisineType] = useState(initialCuisine)
  const [hashtags, setHashtags] = useState<string[]>(initialHashtags)
  const [hashtagInput, setHashtagInput] = useState('')
  const [mustOrder, setMustOrder] = useState(initialMustOrder)
  const [cashDiscount, setCashDiscount] = useState(false)
  const [googleReviewFreebie, setGoogleReviewFreebie] = useState(false)

  return (
    <StepDetails
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
      cashDiscount={cashDiscount}
      setCashDiscount={setCashDiscount}
      googleReviewFreebie={googleReviewFreebie}
      setGoogleReviewFreebie={setGoogleReviewFreebie}
      dishTags={[]}
    />
  )
}

describe('StepDetails', () => {
  test('shows mandatory fields first — body input, taste verdict chips, cuisine row', () => {
    const screen = render(<Harness />)

    expect(screen.getByPlaceholderText(/What did you think/)).toBeTruthy()
    expect(screen.getByText(/How was the food/)).toBeTruthy()
    expect(screen.getByLabelText(/Select cuisine type/)).toBeTruthy()
  })

  test('taste verdict chips are directly visible without tab switching', () => {
    const p = makeProps()
    const screen = render(<StepDetails {...p} />)

    // Taste options are immediately visible — no tab to press first
    fireEvent.press(screen.getByText('Craveable'))
    expect(p.setTasteVerdict).toHaveBeenCalledWith('craveable')
    // No legacy numeric rating called
    expect((p as Record<string, unknown>).setFoodRating).toBeUndefined()
  })

  test('taste verdict toggles off when tapped again', () => {
    const p = makeProps({ tasteVerdict: 'craveable' })
    const screen = render(<StepDetails {...p} />)
    fireEvent.press(screen.getByText('Craveable'))
    expect(p.setTasteVerdict).toHaveBeenCalledWith(undefined)
  })

  test('value verdict chip is visible in More Details section', () => {
    const p = makeProps()
    const screen = render(<StepDetails {...p} />)
    fireEvent.press(screen.getByText('Great value'))
    expect(p.setValueVerdict).toHaveBeenCalledWith('great_value')
    expect((p as Record<string, unknown>).setCostRating).toBeUndefined()
  })

  test('cash discount toggle calls setCashDiscount with true', () => {
    const p = makeProps({ cashDiscount: false })
    const screen = render(<StepDetails {...p} />)
    const toggle = screen.getByLabelText('Cash discounts available')
    fireEvent(toggle, 'valueChange', true)
    expect(p.setCashDiscount).toHaveBeenCalledWith(true)
  })

  test('google review freebie toggle calls setGoogleReviewFreebie with true', () => {
    const p = makeProps({ googleReviewFreebie: false })
    const screen = render(<StepDetails {...p} />)
    const toggle = screen.getByLabelText('Google review freebie available')
    fireEvent(toggle, 'valueChange', true)
    expect(p.setGoogleReviewFreebie).toHaveBeenCalledWith(true)
  })

  test('cuisine selection via action sheet', () => {
    const screen = render(<Harness />)
    fireEvent.press(screen.getByLabelText('Select cuisine type'))
    fireEvent.press(screen.getByLabelText('Select Japanese cuisine'))
    expect(screen.getByText('Japanese')).toBeTruthy()
  })

  test('tags render with # prefix and can be removed', () => {
    const screen = render(<Harness initialHashtags={['ramen']} />)
    expect(screen.getByText('#ramen')).toBeTruthy()
    fireEvent.press(screen.getByLabelText('Remove tag ramen'))
    expect(screen.queryByText('#ramen')).toBeNull()
  })

  test('adds a hashtag via input', () => {
    const screen = render(<Harness />)
    fireEvent.press(screen.getByLabelText('Add tag'))
    const tagInput = screen.getByPlaceholderText('e.g. surryhills, ramen')
    fireEvent.changeText(tagInput, 'ramen')
    fireEvent(tagInput, 'onSubmitEditing')
    expect(screen.getByText('#ramen')).toBeTruthy()
  })
})

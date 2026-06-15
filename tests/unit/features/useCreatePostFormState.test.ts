import { act, renderHook } from '@testing-library/react-native'
import { useCreatePostFormState } from '@/features/create-post/useCreatePostFormState'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

describe('useCreatePostFormState — canAdvanceStep2', () => {
  const userId = 'user-1'

  test('false when body is empty even with tasteVerdict and cuisineType set', () => {
    const { result } = renderHook(() => useCreatePostFormState(userId, undefined))
    act(() => {
      result.current.setTasteVerdict('craveable')
      result.current.setCuisineType('Japanese')
    })
    expect(result.current.canAdvanceStep2).toBe(false)
  })

  test('false when tasteVerdict is missing even with body and cuisineType set', () => {
    const { result } = renderHook(() => useCreatePostFormState(userId, undefined))
    act(() => {
      result.current.setBody('Great food!')
      result.current.setCuisineType('Japanese')
    })
    expect(result.current.canAdvanceStep2).toBe(false)
  })

  test('false when cuisineType is empty even with body and tasteVerdict set', () => {
    const { result } = renderHook(() => useCreatePostFormState(userId, undefined))
    act(() => {
      result.current.setBody('Great food!')
      result.current.setTasteVerdict('craveable')
    })
    expect(result.current.canAdvanceStep2).toBe(false)
  })

  test('true when body, tasteVerdict, and cuisineType are all set', () => {
    const { result } = renderHook(() => useCreatePostFormState(userId, undefined))
    act(() => {
      result.current.setBody('Great food!')
      result.current.setTasteVerdict('craveable')
      result.current.setCuisineType('Japanese')
    })
    expect(result.current.canAdvanceStep2).toBe(true)
  })

  test('cashDiscount and googleReviewFreebie default to false', () => {
    const { result } = renderHook(() => useCreatePostFormState(userId, undefined))
    expect(result.current.cashDiscount).toBe(false)
    expect(result.current.googleReviewFreebie).toBe(false)
  })

  test('cashDiscount can be set to true', () => {
    const { result } = renderHook(() => useCreatePostFormState(userId, undefined))
    act(() => result.current.setCashDiscount(true))
    expect(result.current.cashDiscount).toBe(true)
  })

  test('googleReviewFreebie can be set to true', () => {
    const { result } = renderHook(() => useCreatePostFormState(userId, undefined))
    act(() => result.current.setGoogleReviewFreebie(true))
    expect(result.current.googleReviewFreebie).toBe(true)
  })

  test('clearFormFields resets cashDiscount and googleReviewFreebie to false', () => {
    const { result } = renderHook(() => useCreatePostFormState(userId, undefined))
    act(() => {
      result.current.setCashDiscount(true)
      result.current.setGoogleReviewFreebie(true)
    })
    act(() => result.current.clearFormFields())
    expect(result.current.cashDiscount).toBe(false)
    expect(result.current.googleReviewFreebie).toBe(false)
  })

  test('foodRating, vibeRating, costRating are not in form state', () => {
    const { result } = renderHook(() => useCreatePostFormState(userId, undefined))
    expect((result.current as Record<string, unknown>).foodRating).toBeUndefined()
    expect((result.current as Record<string, unknown>).vibeRating).toBeUndefined()
    expect((result.current as Record<string, unknown>).costRating).toBeUndefined()
  })
})

import { render } from '@testing-library/react-native'
import { Text } from 'react-native'
import { ListSurface } from '@/components/ui/ListSurface'

const mockFlashList = jest.fn()

jest.mock('@shopify/flash-list', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    FlashList: (props: { data: string[]; renderItem: (args: { item: string }) => React.ReactNode }) => {
      mockFlashList(props)
      return React.createElement(
        View,
        { testID: 'flash-list' },
        props.data.map(item => React.createElement(React.Fragment, { key: item }, props.renderItem({ item })))
      )
    },
  }
})

describe('ListSurface', () => {
  beforeEach(() => {
    mockFlashList.mockClear()
  })

  it('hides the vertical scroll indicator by default', () => {
    render(
      <ListSurface
        data={['ramen']}
        renderItem={({ item }) => <Text>{item}</Text>}
      />
    )

    expect(mockFlashList).toHaveBeenCalledWith(
      expect.objectContaining({ showsVerticalScrollIndicator: false })
    )
  })

  it('allows callers to show the vertical scroll indicator', () => {
    render(
      <ListSurface
        data={['ramen']}
        quietScrollIndicator={false}
        renderItem={({ item }) => <Text>{item}</Text>}
      />
    )

    expect(mockFlashList).toHaveBeenCalledWith(
      expect.objectContaining({ showsVerticalScrollIndicator: true })
    )
  })
})

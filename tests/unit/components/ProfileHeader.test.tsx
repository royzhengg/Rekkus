import { fireEvent, render } from '@testing-library/react-native'
import { ProfileHeader } from '@/components/ProfileHeader'

jest.mock('@/lib/contexts/ThemeContext', () => {
  const { lightColors } = jest.requireActual('@/constants/Colors')
  return { useThemeColors: () => lightColors }
})

jest.mock('@/components/Avatar', () => {
  const { Text } = jest.requireActual('react-native')
  return { Avatar: ({ initials }: { initials: string }) => <Text>{initials}</Text> }
})

jest.mock('@/components/icons', () => {
  const { Text } = jest.requireActual('react-native')
  return { PinIcon: () => <Text>pin</Text> }
})

const baseProps = {
  initials: 'SL',
  avatarBg: '#fff',
  avatarColor: '#111',
  displayName: 'Sarah Lee',
  postCount: 3,
  followersLabel: 12,
  followingLabel: 8,
}

describe('ProfileHeader', () => {
  it('makes follower stats pressable when callbacks are provided', () => {
    const onPressFollowers = jest.fn()
    const onPressFollowing = jest.fn()
    const screen = render(
      <ProfileHeader
        {...baseProps}
        onPressFollowers={onPressFollowers}
        onPressFollowing={onPressFollowing}
      />
    )

    fireEvent.press(screen.getByLabelText('Open followers'))
    fireEvent.press(screen.getByLabelText('Open following'))

    expect(onPressFollowers).toHaveBeenCalledTimes(1)
    expect(onPressFollowing).toHaveBeenCalledTimes(1)
  })

  it('keeps follower stats static without callbacks', () => {
    const screen = render(<ProfileHeader {...baseProps} />)

    expect(screen.queryByLabelText('Open followers')).toBeNull()
    expect(screen.queryByLabelText('Open following')).toBeNull()
  })
})

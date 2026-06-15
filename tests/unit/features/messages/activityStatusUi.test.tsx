import { render, screen } from '@testing-library/react-native'
import React from 'react'
import { lightColors } from '@/constants/Colors'
import { ConversationHeader } from '@/features/messages/ConversationHeader'
import { ConversationRow } from '@/features/messages/MessagesListScreen'
import type { ConversationSummary } from '@/lib/services/messaging'
import { getActivityStatus } from '@/lib/utils/activityStatus'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: jest.fn(),
}))

jest.mock('expo-blur', () => ({
  BlurView: ({ children }: { children: React.ReactNode }) => {
    const { View: MockView } = jest.requireActual('react-native')
    return <MockView>{children}</MockView>
  },
}))

jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  return function Swipeable({ children }: { children: React.ReactNode }) {
    const { View: MockView } = jest.requireActual('react-native')
    return <MockView>{children}</MockView>
  }
})

jest.mock('@/components/ui/CachedImage', () => ({
  CachedImage: () => null,
}))

jest.mock('@/components/icons', () => ({
  ArrowLeft: () => {
    const { Text: MockText } = jest.requireActual('react-native')
    return <MockText>back</MockText>
  },
  BellIcon: () => {
    const { Text: MockText } = jest.requireActual('react-native')
    return <MockText>bell</MockText>
  },
  SaveIcon: () => {
    const { Text: MockText } = jest.requireActual('react-native')
    return <MockText>bookmark</MockText>
  },
  CloseIcon: () => {
    const { Text: MockText } = jest.requireActual('react-native')
    return <MockText>close</MockText>
  },
  DotsIcon: () => {
    const { Text: MockText } = jest.requireActual('react-native')
    return <MockText>dots</MockText>
  },
  MailIcon: () => {
    const { Text: MockText } = jest.requireActual('react-native')
    return <MockText>mail</MockText>
  },
  MessageIcon: () => {
    const { Text: MockText } = jest.requireActual('react-native')
    return <MockText>message</MockText>
  },
  PinIcon: () => {
    const { Text: MockText } = jest.requireActual('react-native')
    return <MockText>pin</MockText>
  },
  PlusIcon: () => {
    const { Text: MockText } = jest.requireActual('react-native')
    return <MockText>plus</MockText>
  },
  SearchIcon: () => {
    const { Text: MockText } = jest.requireActual('react-native')
    return <MockText>search</MockText>
  },
  TrashIcon: () => {
    const { Text: MockText } = jest.requireActual('react-native')
    return <MockText>trash</MockText>
  },
  UsersIcon: () => {
    const { Text: MockText } = jest.requireActual('react-native')
    return <MockText>users</MockText>
  },
}))

jest.mock('@/lib/contexts/ThemeContext', () => ({
  useThemeColors: () => {
    const { lightColors: mockLightColors } = jest.requireActual('@/constants/Colors')
    return mockLightColors
  },
}))

jest.mock('@/lib/featureFlags', () => ({
  isEnabled: jest.fn(() => true),
}))

jest.mock('@/lib/services/messaging', () => ({
  MUTE_DURATIONS_MS: {},
  deleteDirectConversation: jest.fn(),
  fetchArchivedConversations: jest.fn(),
  fetchDirectConversations: jest.fn(),
  fetchMessageRequests: jest.fn(),
  leaveGroup: jest.fn(),
  removeChannel: jest.fn(),
  subscribeToInboxMessages: jest.fn(),
}))

jest.mock('@/lib/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

jest.mock('@/lib/contexts/AuthGateContext', () => ({
  useAuthGate: () => ({ requireAuth: jest.fn() }),
}))

jest.mock('@/lib/contexts/ConnectivityContext', () => ({
  useConnectivity: () => ({
    requireOnline: jest.fn(() => true),
    runDeferredMutation: jest.fn(),
    syncEpoch: 0,
  }),
}))

function participant(lastSeenAt: string | null) {
  return {
    user_id: 'user-2',
    username: 'sam',
    full_name: 'Sam Lee',
    avatar_url: null,
    last_seen_at: lastSeenAt,
  }
}

function renderHeader(lastSeenAt: string | null) {
  const status = getActivityStatus(lastSeenAt)
  return render(
    <ConversationHeader
      conversationId="conversation-1"
      participant={participant(lastSeenAt)}
      isGroup={false}
      headerTitle="Sam Lee"
      headerSubtitle={status.kind === 'inactive' || !status.label ? '@sam' : status.label}
      participantPalette={{ bg: '#eee', color: '#111' }}
      searchMode={false}
      searchQuery=""
      onSearch={jest.fn()}
      onBack={jest.fn()}
      onToggleSearch={jest.fn()}
      onOptions={jest.fn()}
      colors={lightColors}
    />,
  )
}

function summary(overrides: Partial<ConversationSummary> = {}): ConversationSummary {
  const base: ConversationSummary = {
    id: 'conversation-1',
    conversation_type: 'direct',
    status: 'active',
    request_status: 'active',
    requested_by: null,
    requested_at: null,
    name: null,
    avatar_url: null,
    pinned_message_id: null,
    updated_at: '2026-06-13T00:00:00.000Z',
    last_read_at: null,
    muted_until: null,
    pinned_at: null,
    archived_at: null,
    unread_count: 0,
    participant: participant('2026-06-12T23:58:00.000Z'),
    participants: [participant('2026-06-12T23:58:00.000Z')],
    last_message: null,
  }
  return { ...base, ...overrides }
}

describe('messaging activity status UI', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-06-13T00:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('shows active now and recent activity in the conversation header', () => {
    renderHeader('2026-06-12T23:58:00.000Z')
    expect(screen.getByText('Active now')).toBeTruthy()

    renderHeader('2026-06-12T23:48:00.000Z')
    expect(screen.getByText('Active 12m ago')).toBeTruthy()
  })

  it('falls back to username when activity is hidden', () => {
    renderHeader(null)
    expect(screen.getByText('@sam')).toBeTruthy()
  })

  it('renders the inbox active dot only for active direct chats', () => {
    const { queryByTestId, rerender } = render(
      <ConversationRow
        item={summary()}
        onPress={jest.fn()}
        onLongPress={jest.fn()}
        onMute={jest.fn()}
        onArchive={jest.fn()}
        onTogglePin={jest.fn()}
        onMarkUnread={jest.fn()}
      />,
    )
    expect(queryByTestId('conversation-active-dot')).toBeTruthy()

    rerender(
      <ConversationRow
        item={summary({ conversation_type: 'group', name: 'Dinner group' })}
        onPress={jest.fn()}
        onLongPress={jest.fn()}
        onMute={jest.fn()}
        onArchive={jest.fn()}
        onTogglePin={jest.fn()}
        onMarkUnread={jest.fn()}
      />,
    )
    expect(queryByTestId('conversation-active-dot')).toBeNull()

    rerender(
      <ConversationRow
        item={summary({ participant: participant(null), participants: [participant(null)] })}
        onPress={jest.fn()}
        onLongPress={jest.fn()}
        onMute={jest.fn()}
        onArchive={jest.fn()}
        onTogglePin={jest.fn()}
        onMarkUnread={jest.fn()}
      />,
    )
    expect(queryByTestId('conversation-active-dot')).toBeNull()
  })
})

import { render } from '@testing-library/react-native'
import React from 'react'
import { PostMediaCarousel } from '@/components/post/PostMediaCarousel'
import { usePostVideoPlayback } from '@/lib/hooks/usePostVideoPlayback'

jest.mock('expo-video', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    VideoView: ({ accessibilityLabel }: { accessibilityLabel: string }) =>
      React.createElement(View, { accessibilityLabel }),
  }
})
jest.mock('@/lib/hooks/usePostVideoPlayback', () => ({
  usePostVideoPlayback: jest.fn(() => ({})),
}))
jest.mock('@/lib/contexts/ThemeContext', () => ({
  useThemeColors: () => ({
    accent: '#000',
    bg: '#fff',
    surface: '#fff',
    surface2: '#eee',
    text: '#000',
    text2: '#222',
    text3: '#444',
    white: '#fff',
  }),
}))

const usePlayback = jest.mocked(usePostVideoPlayback)
const video = [{
  localId: 'video-1',
  uri: 'video.mp4',
  type: 'video' as const,
  processingStatus: 'ready' as const,
}]

describe('PostMediaCarousel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('exposes native video controls and passes active public autoplay ownership', () => {
    const screen = render(<PostMediaCarousel media={video} autoplayActive />)

    expect(screen.getByLabelText('Post video')).toBeTruthy()
    expect(usePlayback).toHaveBeenCalledWith('video.mp4', { autoplayActive: true })
  })

  it('keeps non-public or inactive media tap-to-play only', () => {
    render(<PostMediaCarousel media={video} />)

    expect(usePlayback).toHaveBeenCalledWith('video.mp4', { autoplayActive: false })
  })
})

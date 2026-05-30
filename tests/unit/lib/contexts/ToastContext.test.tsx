import { act, fireEvent, render, screen } from '@testing-library/react-native'
import React from 'react'
import { Text, TouchableOpacity } from 'react-native'
import { ToastProvider, useToast } from '@/lib/contexts/ToastContext'

jest.mock('@/components/ui/Toast', () => {
  const ReactNative = require('react-native')
  const ReactLib = require('react')
  return {
    Toast: ({ visible, message }: { visible: boolean; message: string }) =>
      visible ? ReactLib.createElement(ReactNative.Text, { testID: 'toast-message' }, message) : null,
  }
})

function TriggerToast({ message, type }: { message: string; type?: 'success' | 'info' }) {
  const { showToast } = useToast()
  return (
    <TouchableOpacity testID="trigger" onPress={() => showToast(message, type ? { type } : undefined)}>
      <Text>Show toast</Text>
    </TouchableOpacity>
  )
}

function renderWithProvider(message: string, type?: 'success' | 'info') {
  return render(
    <ToastProvider>
      <TriggerToast message={message} {...(type ? { type } : {})} />
    </ToastProvider>
  )
}

describe('ToastContext', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('toast is hidden before showToast is called', () => {
    renderWithProvider('Post saved')
    expect(screen.queryByTestId('toast-message')).toBeNull()
  })

  it('showToast renders the message', async () => {
    renderWithProvider('Post saved')
    act(() => {
      fireEvent.press(screen.getByTestId('trigger'))
    })
    expect(screen.getByTestId('toast-message').props.children).toBe('Post saved')
  })

  it('auto-dismisses after 3 seconds', () => {
    renderWithProvider('Post saved')
    act(() => {
      fireEvent.press(screen.getByTestId('trigger'))
    })
    expect(screen.getByTestId('toast-message')).toBeTruthy()

    act(() => {
      jest.advanceTimersByTime(3000)
    })
    expect(screen.queryByTestId('toast-message')).toBeNull()
  })

  it('a second showToast call resets the dismiss timer', () => {
    renderWithProvider('Post saved')
    act(() => {
      fireEvent.press(screen.getByTestId('trigger'))
    })
    // Advance 2 s — dismiss timer has not fired yet
    act(() => { jest.advanceTimersByTime(2000) })
    expect(screen.getByTestId('toast-message')).toBeTruthy()

    // Call showToast again — resets the 3 s timer
    act(() => {
      fireEvent.press(screen.getByTestId('trigger'))
    })
    // Advance another 2 s — now 2 s since the second call; should still be visible
    act(() => { jest.advanceTimersByTime(2000) })
    expect(screen.getByTestId('toast-message')).toBeTruthy()

    // Advance 1 more second (3 s total from second call) — should dismiss
    act(() => { jest.advanceTimersByTime(1000) })
    expect(screen.queryByTestId('toast-message')).toBeNull()
  })
})

import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'

type State = { error: Error | null }

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  State
> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback
      return (
        <View style={styles.wrap}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.msg} numberOfLines={3}>
            {this.state.error.message}
          </Text>
          <TouchableOpacity style={styles.btn} onPress={this.reset}>
            <Text style={styles.btnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      )
    }
    return this.props.children
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  title: { fontSize: 16, fontWeight: '600', color: '#1A1A18' },
  msg: { fontSize: 13, color: '#6B6B66', textAlign: 'center', lineHeight: 20 },
  btn: {
    marginTop: 8,
    backgroundColor: '#1A1A18',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  btnText: { fontSize: 14, fontWeight: '500', color: '#FAFAF8' },
})

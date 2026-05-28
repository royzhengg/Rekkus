import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { colors } from '@/constants/Colors'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'
import { captureCrash } from '@/lib/services/crashReporting'

type State = { error: Error | null }

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  State
> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error) {
    captureCrash(error)
  }

  reset = () => this.setState({ error: null })

  override render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback
      return (
        <View style={styles.wrap}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.msg} numberOfLines={3}>
            {this.state.error.message}
          </Text>
          <TouchableOpacity style={styles.btn} onPress={this.reset} accessibilityRole="button">
            <Text style={styles.btnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      )
    }
    return this.props.children
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[8], gap: spacing[3] },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.semibold, color: colors.text },
  msg: { fontSize: fontSize.base, color: colors.text2, textAlign: 'center', lineHeight: lineHeight.normal },
  btn: {
    marginTop: spacing[2],
    backgroundColor: colors.text,
    borderRadius: radius.pill,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
  },
  btnText: { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: colors.bg },
})

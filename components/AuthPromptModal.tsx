import { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'

interface Props {
  visible: boolean
  onDismiss: () => void
  onCreateAccount: () => void
  onSignIn: () => void
}

export function AuthPromptModal({ visible, onDismiss, onCreateAccount, onSignIn }: Props) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  function run(action: () => void) {
    onDismiss()
    action()
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.headline}>
          Join Rekkus<Text style={styles.dot}>.</Text>
        </Text>
        <Text style={styles.sub}>Like, save, and discover more.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => run(onCreateAccount)}>
          <Text style={styles.primaryBtnText}>Create account</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => run(onSignIn)}>
          <Text style={styles.secondaryBtnText}>Sign in</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: c.overlay },
    sheet: {
      backgroundColor: c.bg,
      borderTopLeftRadius: radius.pill,
      borderTopRightRadius: radius.pill,
      borderTopWidth: 0.5,
      borderTopColor: c.border,
      paddingHorizontal: spacing[4],
      paddingBottom: spacing.px36,
    },
    handle: {
      width: 36,
      height: 4,
      backgroundColor: c.surface2,
      borderRadius: radius.xxs,
      alignSelf: 'center',
      marginTop: spacing.px10,
      marginBottom: spacing[6],
    },
    headline: {
      fontFamily: 'DMSerifDisplay-Regular',
      fontSize: fontSize['5xl'],
      color: c.text,
      marginBottom: spacing.px6,
      letterSpacing: -0.3,
    },
    dot: { color: c.accent },
    sub: { fontSize: fontSize.md, color: c.text2, marginBottom: spacing.px28, lineHeight: lineHeight.normal },
    primaryBtn: {
      backgroundColor: c.text,
      borderRadius: radius.pill,
      paddingVertical: spacing.px14,
      alignItems: 'center',
      marginBottom: spacing.px10,
    },
    primaryBtnText: { fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: c.bg },
    secondaryBtn: {
      backgroundColor: c.surface,
      borderRadius: radius.pill,
      paddingVertical: spacing.px14,
      alignItems: 'center',
      borderWidth: 0.5,
      borderColor: c.border2,
    },
    secondaryBtnText: { fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: c.text },
  })
}

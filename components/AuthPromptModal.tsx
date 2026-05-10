import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { useThemeColors } from '@/lib/ThemeContext'
import { useMemo } from 'react'

interface Props {
  visible: boolean
  onDismiss: () => void
}

export function AuthPromptModal({ visible, onDismiss }: Props) {
  const router = useRouter()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  function goTo(path: '/(auth)/welcome' | '/(auth)/login') {
    onDismiss()
    router.push(path)
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
        <TouchableOpacity style={styles.primaryBtn} onPress={() => goTo('/(auth)/welcome')}>
          <Text style={styles.primaryBtnText}>Create account</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => goTo('/(auth)/login')}>
          <Text style={styles.secondaryBtnText}>Sign in</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
    sheet: {
      backgroundColor: c.bg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderTopWidth: 0.5,
      borderTopColor: c.border,
      paddingHorizontal: 16,
      paddingBottom: 36,
    },
    handle: {
      width: 36,
      height: 4,
      backgroundColor: c.surface2,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: 10,
      marginBottom: 24,
    },
    headline: {
      fontFamily: 'DMSerifDisplay-Regular',
      fontSize: 26,
      color: c.text,
      marginBottom: 6,
      letterSpacing: -0.3,
    },
    dot: { color: c.accent },
    sub: { fontSize: 14, color: c.text2, marginBottom: 28, lineHeight: 20 },
    primaryBtn: {
      backgroundColor: c.text,
      borderRadius: 20,
      paddingVertical: 14,
      alignItems: 'center',
      marginBottom: 10,
    },
    primaryBtnText: { fontSize: 15, fontWeight: '500', color: c.bg },
    secondaryBtn: {
      backgroundColor: c.surface,
      borderRadius: 20,
      paddingVertical: 14,
      alignItems: 'center',
      borderWidth: 0.5,
      borderColor: c.border2,
    },
    secondaryBtnText: { fontSize: 15, fontWeight: '500', color: c.text },
  })
}

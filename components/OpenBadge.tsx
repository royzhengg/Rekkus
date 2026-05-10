import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

export const OpenBadge = React.memo(function OpenBadge({ openNow }: { openNow: boolean }) {
  return (
    <View style={[styles.badge, openNow ? styles.open : styles.closed]}>
      <Text style={[styles.text, openNow ? styles.textOpen : styles.textClosed]}>
        {openNow ? 'Open' : 'Closed'}
      </Text>
    </View>
  )
})

const styles = StyleSheet.create({
  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  open: { backgroundColor: '#E6F4EA' },
  closed: { backgroundColor: '#FDECEA' },
  text: { fontSize: 11, fontWeight: '500' },
  textOpen: { color: '#1E7E34' },
  textClosed: { color: '#C62828' },
})

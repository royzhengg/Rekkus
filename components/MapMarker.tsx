import React from 'react'
import { View, Text } from 'react-native'
import { Svg, Path, Circle } from 'react-native-svg'
import { useThemeColors } from '@/lib/ThemeContext'

export const MapMarker = React.memo(function MapMarker({ name }: { name?: string }) {
  const c = useThemeColors()
  return (
    <View style={{ alignItems: 'center' }}>
      {!!name && (
        <View
          style={{
            backgroundColor: c.bg,
            borderRadius: 6,
            paddingHorizontal: 6,
            paddingVertical: 3,
            marginBottom: 3,
            maxWidth: 120,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.15,
            shadowRadius: 3,
          }}
        >
          <Text
            style={{ fontSize: 10, fontWeight: '600', color: c.text, letterSpacing: 0.1 }}
            numberOfLines={1}
          >
            {name}
          </Text>
        </View>
      )}
      <Svg width={26} height={34} viewBox="0 0 26 34">
        <Path
          d="M13 0C5.82 0 0 5.82 0 13c0 8.667 13 21 13 21S26 21.667 26 13C26 5.82 20.18 0 13 0z"
          fill={c.text}
        />
        <Circle cx={13} cy={13} r={4.5} fill={c.bg} />
      </Svg>
    </View>
  )
})

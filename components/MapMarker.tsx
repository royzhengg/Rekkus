import React from 'react'
import { View, Text } from 'react-native'
import { Svg, Path, Circle } from 'react-native-svg'
import { elevation } from '@/constants/Elevation'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, letterSpacing } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'

export const MapMarker = React.memo(function MapMarker({ name }: { name?: string }) {
  const c = useThemeColors()
  return (
    <View style={{ alignItems: 'center' }}>
      {!!name && (
        <View
          style={{
            backgroundColor: c.bg,
            borderRadius: radius.sm,
            paddingHorizontal: spacing.px6,
            paddingVertical: spacing.px3,
            marginBottom: spacing.px3,
            maxWidth: 120,
            ...elevation.xs,
          }}
        >
          <Text
            style={{ fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: c.text, letterSpacing: letterSpacing.fine }}
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

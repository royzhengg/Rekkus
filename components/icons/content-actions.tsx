import React from 'react'
import { Svg, Path, Circle, Polyline, Line, Rect } from 'react-native-svg'
import { useThemeColors } from '@/lib/contexts/ThemeContext'

export const ImagePlaceholder = React.memo(function ImagePlaceholder({
  size = 24,
  color,
}: {
  size?: number
  color?: string
}) {
  const colors = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? colors.text3} strokeWidth={0.8} strokeLinecap="round">
      <Rect x={3} y={3} width={18} height={18} rx={2} />
      <Circle cx={8.5} cy={8.5} r={1.5} />
      <Polyline points="21 15 16 10 5 21" />
    </Svg>
  )
})

export const CameraIcon = React.memo(function CameraIcon({
  size = 18,
  color,
}: {
  size?: number
  color?: string
}) {
  const { text2 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? text2} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <Circle cx={12} cy={13} r={4} />
    </Svg>
  )
})

export const EyeIcon = React.memo(function EyeIcon({
  open = true,
  size = 18,
}: {
  open?: boolean
  size?: number
}) {
  const { text3 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={text3} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      {open ? (
        <>
          <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <Path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
        </>
      ) : (
        <>
          <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <Path d="M1 1l22 22" />
        </>
      )}
    </Svg>
  )
})

export const PlusIcon = React.memo(function PlusIcon({ size = 18, color }: { size?: number; color?: string }) {
  const { text3 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? text3} strokeWidth={1.5} strokeLinecap="round">
      <Line x1={12} y1={5} x2={12} y2={19} />
      <Line x1={5} y1={12} x2={19} y2={12} />
    </Svg>
  )
})

export const CheckIcon = React.memo(function CheckIcon({ size = 18, color }: { size?: number; color?: string }) {
  const { text2 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? text2} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="20 6 9 17 4 12" />
    </Svg>
  )
})

export const EditIcon = React.memo(function EditIcon({ size = 18, color }: { size?: number; color?: string }) {
  const { text2 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? text2} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Svg>
  )
})

export const TrashIcon = React.memo(function TrashIcon({ size = 18, color }: { size?: number; color?: string }) {
  const { text2 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? text2} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="3 6 5 6 21 6" />
      <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <Line x1={10} y1={11} x2={10} y2={17} />
      <Line x1={14} y1={11} x2={14} y2={17} />
    </Svg>
  )
})

export const StarIcon = React.memo(function StarIcon({
  filled = false,
  size = 18,
  color,
}: {
  filled?: boolean
  size?: number
  color?: string
}) {
  const { accent, text2 } = useThemeColors()
  const stroke = color ?? (filled ? accent : text2)
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? stroke : 'none'} stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </Svg>
  )
})

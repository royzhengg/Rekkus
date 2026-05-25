import React from 'react'
import { Svg, Path, Circle, Polyline, Line, Rect } from 'react-native-svg'
import { useThemeColors } from '@/lib/contexts/ThemeContext'

export const GridIcon = React.memo(function GridIcon({ size = 18, color }: { size?: number; color?: string }) {
  const { text2 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? text2} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={3} y={3} width={7} height={7} />
      <Rect x={14} y={3} width={7} height={7} />
      <Rect x={14} y={14} width={7} height={7} />
      <Rect x={3} y={14} width={7} height={7} />
    </Svg>
  )
})

export const GalleryIcon = React.memo(function GalleryIcon({ size = 20, color }: { size?: number; color?: string }) {
  const { text2 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? text2} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={3} y={3} width={18} height={18} rx={2} />
      <Circle cx={8.5} cy={8.5} r={1.5} />
      <Polyline points="21 15 16 10 5 21" />
    </Svg>
  )
})

export const VideoIcon = React.memo(function VideoIcon({ size = 20, color }: { size?: number; color?: string }) {
  const { text2 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? text2} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.845v6.31a1 1 0 0 1-1.447.914L15 14" />
      <Rect x={3} y={8} width={12} height={8} rx={1.5} />
    </Svg>
  )
})

export const MapPinIcon = React.memo(function MapPinIcon({ size = 20, color }: { size?: number; color?: string }) {
  const { text2 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? text2} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 2C8.686 2 6 4.686 6 8c0 5.25 6 14 6 14s6-8.75 6-14c0-3.314-2.686-6-6-6z" />
      <Circle cx={12} cy={8} r={2} />
    </Svg>
  )
})

export const PaperclipIcon = React.memo(function PaperclipIcon({ size = 20, color }: { size?: number; color?: string }) {
  const { text2 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? text2} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </Svg>
  )
})

export const UsersIcon = React.memo(function UsersIcon({ size = 20, color }: { size?: number; color?: string }) {
  const { text2 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? text2} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <Circle cx={9} cy={7} r={4} />
      <Path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  )
})

export const ListIcon = React.memo(function ListIcon({ size = 18, color }: { size?: number; color?: string }) {
  const { text2 } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? text2} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Line x1={8} y1={6} x2={21} y2={6} />
      <Line x1={8} y1={12} x2={21} y2={12} />
      <Line x1={8} y1={18} x2={21} y2={18} />
      <Line x1={3} y1={6} x2={3.01} y2={6} />
      <Line x1={3} y1={12} x2={3.01} y2={12} />
      <Line x1={3} y1={18} x2={3.01} y2={18} />
    </Svg>
  )
})

export const ReplyIcon = React.memo(function ReplyIcon({ size = 16, color }: { size?: number; color?: string }) {
  const { text } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? text} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 17l-5-5 5-5" />
      <Path d="M4 12h11a5 5 0 0 1 5 5v1" />
    </Svg>
  )
})

export const CopyIcon = React.memo(function CopyIcon({ size = 16, color }: { size?: number; color?: string }) {
  const { text } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? text} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={9} y={9} width={13} height={13} rx={2} ry={2} />
      <Path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Svg>
  )
})

export const ForwardIcon = React.memo(function ForwardIcon({ size = 16, color }: { size?: number; color?: string }) {
  const { text } = useThemeColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? text} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 17l5-5-5-5" />
      <Path d="M20 12H9a5 5 0 0 0-5 5v1" />
    </Svg>
  )
})

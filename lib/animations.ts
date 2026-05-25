import type { WithSpringConfig } from 'react-native-reanimated'

// Spring physics tokens — use with withSpring() or .springify().damping/stiffness
export const SPRING_SNAPPY: WithSpringConfig = { damping: 18, stiffness: 350 }  // buttons, context menu pop-in
export const SPRING_SMOOTH: WithSpringConfig = { damping: 22, stiffness: 220 }  // modals, card slides
export const SPRING_CARD:   WithSpringConfig = { damping: 20, stiffness: 180 }  // map/restaurant card slide-up

// Timing constants (ms)
export const DUR_FAST = 150   // backdrop overlay fade
export const DUR_MID  = 180   // component enter/exit
export const DUR_SLOW = 220   // subtle state fades

// Button press scales
export const PRESS_SCALE_PRIMARY = 0.96   // large CTAs
export const PRESS_SCALE_ICON    = 0.90   // TabBarPostButton, icon buttons

// Reaction row stagger
export const EMOJI_STAGGER_MS = 35        // per-emoji delay — produces Instagram-style wave entrance

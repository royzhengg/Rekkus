import { useMemo } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import { EMOJI_STAGGER_MS, SPRING_SNAPPY } from '@/lib/animations'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'
import type { PostReactionType } from '@/lib/services/posts'

const REACTIONS: { type: PostReactionType; emoji: string; label: string }[] = [
  { type: 'helpful', emoji: '👍', label: 'Helpful' },
  { type: 'love', emoji: '❤️', label: 'Love This' },
  { type: 'thanks', emoji: '🙏', label: 'Thanks' },
  { type: 'oh_no', emoji: '😬', label: 'Oh No' },
]

type ReactionButtonProps = {
  type: PostReactionType
  emoji: string
  label: string
  index: number
  active: boolean
  count: number
  onToggle: (type: PostReactionType) => void
  styles: ReturnType<typeof makeStyles>
  reduceMotion: boolean
}

function ReactionButton({ type, emoji, label, index, active, count, onToggle, styles, reduceMotion }: ReactionButtonProps) {
  const scale = useSharedValue(1)
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  function handlePress() {
    if (!reduceMotion) {
      scale.value = withSequence(withSpring(1.22, SPRING_SNAPPY), withSpring(1, SPRING_SNAPPY))
    }
    void onToggle(type)
  }

  return (
    <Animated.View
      {...(!reduceMotion ? { entering: FadeInUp.delay(index * EMOJI_STAGGER_MS).springify() } : {})}
    >
      <Animated.View style={scaleStyle}>
        <TouchableOpacity
          style={[styles.reactionBtn, active && styles.reactionBtnActive]}
          onPress={handlePress}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`${active ? 'Remove' : 'Add'} ${label} reaction`}
        >
          <Text style={styles.reactionEmoji}>{emoji}</Text>
          <Text style={[styles.reactionLabel, active && styles.reactionLabelActive]}>
            {label}
          </Text>
          {count > 0 && (
            <Text style={[styles.reactionCount, active && styles.reactionLabelActive]}>
              {count}
            </Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  )
}

type Props = {
  myReactions: PostReactionType[]
  reactionCounts: Record<string, number>
  onToggleReaction: (type: PostReactionType) => void
}

export function PostReactionBar({ myReactions, reactionCounts, onToggleReaction }: Props) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const reduceMotion = useReducedMotion()

  return (
    <View style={styles.reactionsBar}>
      {REACTIONS.map(({ type, emoji, label }, index) => (
        <ReactionButton
          key={type}
          type={type}
          emoji={emoji}
          label={label}
          index={index}
          active={myReactions.includes(type)}
          count={reactionCounts[type] ?? 0}
          onToggle={onToggleReaction}
          styles={styles}
          reduceMotion={reduceMotion}
        />
      ))}
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    reactionsBar: {
      flexDirection: 'row',
      gap: spacing.px6,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing.px10,
      borderTopWidth: 0.5,
      borderTopColor: c.border,
      flexWrap: 'nowrap',
    },
    reactionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
      paddingHorizontal: spacing.px10,
      paddingVertical: spacing.px6,
      borderRadius: radius.pill,
      borderWidth: 0.5,
      borderColor: c.border2,
      backgroundColor: c.surface,
    },
    reactionBtnActive: {
      borderColor: `${c.accent}44`,
      backgroundColor: `${c.accent}10`,
    },
    reactionEmoji: { fontSize: fontSize.base },
    reactionLabel: { fontSize: fontSize.sm, color: c.text2, fontWeight: fontWeight.bold },
    reactionLabelActive: { color: c.accent, fontWeight: fontWeight.black },
    reactionCount: { fontSize: fontSize.sm, color: c.text3 },
  })
}

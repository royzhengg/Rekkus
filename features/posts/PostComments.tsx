import { useMemo } from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Avatar } from '@/components/Avatar'
import { SendIcon } from '@/components/icons'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import type { PostCommentRow } from '@/lib/services/posts'
import { avatarPalette } from '@/lib/utils/format'
import type { RefObject} from 'react';

type ReplyTarget = { commentId: string; username: string } | null

type Props = {
  comments: PostCommentRow[]
  comment: string
  submitting: boolean
  replyTo: ReplyTarget
  userEmail?: string | null | undefined
  inputRef: RefObject<TextInput | null>
  onChangeComment: (value: string) => void
  onFocusInput: () => void
  onSubmitComment: () => void
  onReplyTo: (target: NonNullable<ReplyTarget>) => void
  onClearReply: () => void
  onReportComment: (commentId: string) => void
}

export function PostComments({
  comments,
  comment,
  submitting,
  replyTo,
  userEmail,
  inputRef,
  onChangeComment,
  onFocusInput,
  onSubmitComment,
  onReplyTo,
  onClearReply,
  onReportComment,
}: Props) {
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { topLevel, repliesMap } = useMemo(() => {
    const top: PostCommentRow[] = []
    const replies = new Map<string, PostCommentRow[]>()
    for (const item of comments) {
      if (!item.parent_id) top.push(item)
      else {
        const bucket = replies.get(item.parent_id) ?? []
        bucket.push(item)
        replies.set(item.parent_id, bucket)
      }
    }
    return { topLevel: top, repliesMap: replies }
  }, [comments])

  return (
    <>
      <View style={styles.commentsSection}>
        <Text style={styles.commentsHeading}>
          {comments.length > 0 ? `Comments (${comments.length})` : 'Comments'}
        </Text>
        {topLevel.map(item => {
          const username = item.users?.username ?? 'user'
          const palette = avatarPalette(username)
          const replies = repliesMap.get(item.id) ?? []
          return (
            <View key={item.id}>
              <View style={styles.comment}>
                <Avatar
                  initials={username.slice(0, 2).toUpperCase()}
                  bg={palette.bg}
                  color={palette.color}
                  size={24}
                />
                <View style={styles.commentBody}>
                  <Text style={styles.commentHandle}>@{username}</Text>
                  <Text style={styles.commentText}>{item.content}</Text>
                  <View style={styles.commentActions}>
                    <TouchableOpacity
                      onPress={() => onReplyTo({ commentId: item.id, username })}
                      style={styles.replyBtn}
                      accessibilityRole="button"
                      accessibilityLabel={`Reply to @${username}`}
                    >
                      <Text style={styles.replyBtnText}>Reply</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => onReportComment(item.id)}
                      style={styles.replyBtn}
                      accessibilityRole="button"
                      accessibilityLabel={`Report @${username}'s comment`}
                    >
                      <Text style={styles.replyBtnText}>Report</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              {replies.map(reply => {
                const replyUsername = reply.users?.username ?? 'user'
                const replyPalette = avatarPalette(replyUsername)
                return (
                  <View key={reply.id} style={styles.replyRow}>
                    <Avatar
                      initials={replyUsername.slice(0, 2).toUpperCase()}
                      bg={replyPalette.bg}
                      color={replyPalette.color}
                      size={20}
                    />
                    <View style={styles.commentBody}>
                      <Text style={styles.commentHandle}>@{replyUsername}</Text>
                      <Text style={styles.commentText}>{reply.content}</Text>
                    </View>
                  </View>
                )
              })}
            </View>
          )
        })}
        {comments.length === 0 && (
          <Text style={styles.noComments}>No comments yet. Add the first food note.</Text>
        )}
      </View>

      <View style={styles.commentInputWrap}>
        {replyTo && (
          <View style={styles.replyBanner}>
            <Text style={styles.replyBannerText}>Replying to @{replyTo.username}</Text>
            <TouchableOpacity
              onPress={onClearReply}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Cancel reply"
            >
              <Text style={styles.replyBannerDismiss}>x</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.commentInputBar}>
          <Avatar
            initials={userEmail ? (userEmail.slice(0, 2).toUpperCase() ?? 'ME') : 'ME'}
            bg={colors.ratingBg}
            color={colors.ratingText}
            size={28}
          />
          <TextInput
            ref={inputRef}
            style={styles.commentField}
            placeholder={replyTo ? `Reply to @${replyTo.username}...` : 'Add a comment...'}
            placeholderTextColor={colors.text3}
            value={comment}
            onChangeText={onChangeComment}
            onFocus={onFocusInput}
            onSubmitEditing={onSubmitComment}
            returnKeyType="send"
            editable={!submitting}
          />
          <TouchableOpacity
            style={styles.sendBtn}
            onPress={onSubmitComment}
            disabled={submitting || !comment.trim()}
            accessibilityRole="button"
            accessibilityLabel="Send comment"
          >
            <SendIcon active={!!comment.trim()} />
          </TouchableOpacity>
        </View>
      </View>
    </>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    commentsSection: {
      borderTopWidth: 0.5,
      borderTopColor: c.border,
      padding: spacing[3],
      paddingHorizontal: spacing[4],
    },
    commentsHeading: {
      fontSize: fontSize.base,
      fontWeight: fontWeight.black,
      color: c.text,
      marginBottom: spacing.px10,
      textTransform: 'uppercase',
    },
    noComments: { fontSize: fontSize.bodySm, color: c.text3, textAlign: 'center', paddingVertical: spacing[3] },
    comment: { flexDirection: 'row', gap: spacing.px9, marginBottom: spacing[3] },
    commentBody: { flex: 1 },
    commentHandle: { fontSize: fontSize.sm, fontWeight: fontWeight.extrabold, color: c.text },
    commentText: { fontSize: fontSize.bodySm, color: c.text2, lineHeight: lineHeight.small },
    commentActions: { flexDirection: 'row', gap: spacing.px14, marginTop: spacing.px5 },
    replyBtn: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
    replyBtnText: { fontSize: fontSize.sm, color: c.text3, fontWeight: fontWeight.extrabold },
    replyRow: {
      flexDirection: 'row',
      gap: spacing[2],
      marginBottom: spacing[2],
      marginLeft: spacing[8],
      paddingLeft: spacing[3],
      borderLeftWidth: 1.5,
      borderLeftColor: `${c.accent}24`,
    },
    commentInputWrap: {
      borderTopWidth: 0.5,
      borderTopColor: c.border,
      backgroundColor: c.bg,
    },
    replyBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[4],
      paddingTop: spacing[2],
      paddingBottom: spacing[1],
    },
    replyBannerText: { fontSize: fontSize.sm, color: c.text3 },
    replyBannerDismiss: { fontSize: fontSize.bodySm, color: c.text3, paddingLeft: spacing[2] },
    commentInputBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.px9,
      paddingHorizontal: spacing[4],
      paddingTop: spacing[2],
      paddingBottom: spacing[4],
      backgroundColor: c.bg,
    },
    commentField: {
      flex: 1,
      backgroundColor: c.bg,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.px14,
      paddingVertical: spacing[2],
      fontSize: fontSize.base,
      color: c.text,
      borderWidth: 0.5,
      borderColor: c.border,
    },
    sendBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  })
}

import React, { useMemo } from 'react'
import { View, TouchableOpacity, Image, StyleSheet, useWindowDimensions } from 'react-native'
import { useRouter } from 'expo-router'
import { imgColors } from '@/constants/Colors'
import { ImagePlaceholder } from '@/components/icons'
import type { Post } from '@/lib/data'

type Props = {
  posts: Post[]
}

export const ThumbGrid = React.memo(function ThumbGrid({ posts }: Props) {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const styles = useMemo(() => makeStyles(), [])
  const thumbSize = (width - 4) / 3

  if (posts.length === 0) return null

  return (
    <View style={styles.grid}>
      {posts.map(post => (
        <TouchableOpacity
          key={post.id}
          style={[styles.thumb, { width: thumbSize, height: thumbSize }]}
          onPress={() => router.push(`/post/${post.id}`)}
          activeOpacity={0.8}
        >
          <View style={[styles.inner, { backgroundColor: imgColors[post.imgKey] }]}>
            {post.imageUrl ? (
              <Image
                source={{ uri: post.imageUrl }}
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
              />
            ) : (
              <ImagePlaceholder size={20} />
            )}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  )
})

function makeStyles() {
  return StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, padding: 2 },
    thumb: { overflow: 'hidden' },
    inner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  })
}

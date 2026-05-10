import React, { createContext, useContext, useState } from 'react'
import {
  POSTS,
  Post,
  IMG_KEYS,
  MY_CREATOR,
  MY_INITIALS,
  MY_AVATAR_BG,
  MY_AVATAR_COLOR,
} from './data'

interface PostsContextValue {
  posts: Post[]
  addPost: (
    draft: Omit<Post, 'id' | 'dbId' | 'likes' | 'creator' | 'initials' | 'avatarBg' | 'avatarColor'>
  ) => void
  refresh: () => void
}

const PostsContext = createContext<PostsContextValue>({
  posts: POSTS,
  addPost: () => {},
  refresh: () => {},
})

export function PostsProvider({ children }: { children: React.ReactNode }) {
  const [posts, setPosts] = useState<Post[]>(POSTS)

  function addPost(
    draft: Omit<Post, 'id' | 'dbId' | 'likes' | 'creator' | 'initials' | 'avatarBg' | 'avatarColor'>
  ) {
    const newPost: Post = {
      ...draft,
      id: Date.now(),
      dbId: '',
      likes: '0',
      creator: MY_CREATOR,
      initials: MY_INITIALS,
      avatarBg: MY_AVATAR_BG,
      avatarColor: MY_AVATAR_COLOR,
      imgKey: IMG_KEYS[Math.floor(Math.random() * IMG_KEYS.length)],
    }
    setPosts(prev => [newPost, ...prev])
  }

  // TODO: replace with Supabase re-fetch once real data layer is wired
  function refresh() {
    setPosts([...POSTS])
  }

  return (
    <PostsContext.Provider value={{ posts, addPost, refresh }}>{children}</PostsContext.Provider>
  )
}

export function usePosts() {
  return useContext(PostsContext)
}

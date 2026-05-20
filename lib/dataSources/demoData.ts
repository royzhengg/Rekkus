import { ALLOW_MOCK_DATA } from '@/lib/config'
import {
  IMG_KEYS,
  MOCK_USERS,
  MY_AVATAR_BG,
  MY_AVATAR_COLOR,
  MY_CREATOR,
  MY_INITIALS,
  POSTS,
  RESTAURANTS,
} from '@/lib/mocks/data'

export const demoPosts = ALLOW_MOCK_DATA ? POSTS : []
export const demoRestaurants = ALLOW_MOCK_DATA ? RESTAURANTS : []
export const demoUsers = ALLOW_MOCK_DATA ? MOCK_USERS : {}

export const demoCurrentUser = {
  username: ALLOW_MOCK_DATA ? MY_CREATOR : '',
  initials: ALLOW_MOCK_DATA ? MY_INITIALS : '',
  avatarBg: ALLOW_MOCK_DATA ? MY_AVATAR_BG : '',
  avatarColor: ALLOW_MOCK_DATA ? MY_AVATAR_COLOR : '',
}

export const demoImageKeys = IMG_KEYS

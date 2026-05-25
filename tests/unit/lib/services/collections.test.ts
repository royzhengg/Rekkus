import { addTargetToCollection, unsaveTarget } from '@/lib/services/collections'
import { supabase } from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: jest.fn() },
}))

const mockRpc = jest.mocked(supabase.rpc)

describe('collection saved-target RPC contract', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRpc.mockResolvedValue({ data: undefined, error: null } as never)
  })

  it('adds canonical dish membership through the base-save RPC', async () => {
    await addTargetToCollection('collection-1', 'dish', 'dish-1')

    expect(mockRpc).toHaveBeenCalledWith('add_saved_target_to_collection', {
      p_collection_id: 'collection-1',
      p_target_type: 'dish',
      p_target_id: 'dish-1',
    })
  })

  it('passes confirmed membership removal to transactional unsave', async () => {
    await unsaveTarget('restaurant', 'restaurant-1', true)

    expect(mockRpc).toHaveBeenCalledWith('unsave_target', {
      p_target_type: 'restaurant',
      p_target_id: 'restaurant-1',
      p_remove_collection_memberships: true,
    })
  })
})

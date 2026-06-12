import { addTargetToCollection, fetchProfileCollections, unsaveTarget, updateCollectionVisibility } from '@/lib/services/collections'
import { supabase } from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: jest.fn(), from: jest.fn() },
}))

const mockRpc = jest.mocked(supabase.rpc)
const mockFrom = jest.mocked(supabase.from)

type CollectionQueryBuilder = {
  select: jest.Mock
  eq: jest.Mock
  order: jest.Mock
  limit: jest.Mock
  in: jest.Mock
  update: jest.Mock
  maybeSingle: jest.Mock
}

function collectionQuery(result: unknown): CollectionQueryBuilder {
  const builder: CollectionQueryBuilder = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    in: jest.fn(),
    update: jest.fn(),
    maybeSingle: jest.fn(),
  }
  builder.select.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  builder.order.mockReturnValue(builder)
  builder.limit.mockResolvedValue(result)
  builder.in.mockReturnValue(builder)
  builder.update.mockReturnValue(builder)
  builder.maybeSingle.mockResolvedValue({ data: { share_slug: null }, error: null })
  return builder
}

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

  it('loads owner profile collections without public visibility filtering', async () => {
    const builder = collectionQuery({
      data: [{ id: 'collection-1', user_id: 'user-1', name: 'Best ramen', description: null, visibility: 'private', share_slug: null, is_staff_pick: false, curator_note: null }],
      error: null,
    })
    mockFrom.mockReturnValue(builder as never)

    await expect(fetchProfileCollections('user-1', true)).resolves.toHaveLength(1)

    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(builder.limit).toHaveBeenCalledWith(20)
    expect(builder.in).not.toHaveBeenCalled()
  })

  it('loads only public collections for public profiles', async () => {
    const builder = collectionQuery({
      data: [{ id: 'collection-1', user_id: 'user-1', name: 'Best ramen', description: null, visibility: 'public', share_slug: null, is_staff_pick: false, curator_note: null }],
      error: null,
    })
    mockFrom.mockReturnValue(builder as never)

    await fetchProfileCollections('user-1', false)

    expect(builder.in).toHaveBeenCalledWith('visibility', ['public'])
  })
})

describe('updateCollectionVisibility', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRpc.mockResolvedValue({ data: undefined, error: null } as never)
  })

  it('updates visibility and generates a share_slug when moving to public with no existing slug', async () => {
    const builder = collectionQuery({ data: null, error: null })
    builder.maybeSingle.mockResolvedValue({ data: { share_slug: null }, error: null })
    builder.eq.mockReturnValue(builder)
    mockFrom.mockReturnValue(builder as never)

    await updateCollectionVisibility('collection-1', 'public')

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ visibility: 'public', share_slug: expect.any(String) })
    )
  })

  it('does not overwrite an existing share_slug', async () => {
    const builder = collectionQuery({ data: null, error: null })
    builder.maybeSingle.mockResolvedValue({ data: { share_slug: 'abc123-xyz' }, error: null })
    builder.eq.mockReturnValue(builder)
    mockFrom.mockReturnValue(builder as never)

    await updateCollectionVisibility('collection-1', 'public')

    expect(builder.update).toHaveBeenCalledWith(
      expect.not.objectContaining({ share_slug: expect.anything() })
    )
  })

  it('fires the visibility_changed audit event', async () => {
    const builder = collectionQuery({ data: null, error: null })
    mockFrom.mockReturnValue(builder as never)

    await updateCollectionVisibility('collection-1', 'private')

    expect(mockRpc).toHaveBeenCalledWith('record_collection_audit_event', {
      p_collection_id: 'collection-1',
      p_event_type: 'visibility_changed',
      p_context: { visibility: 'private' },
    })
  })

  it('propagates Supabase errors', async () => {
    const selectBuilder = collectionQuery({ data: null, error: null })
    selectBuilder.maybeSingle.mockResolvedValue({ data: { share_slug: null }, error: null })
    const updateBuilder = {
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: { message: 'db error' } }),
      }),
    }
    mockFrom
      .mockReturnValueOnce(selectBuilder as never)
      .mockReturnValueOnce(updateBuilder as never)

    await expect(updateCollectionVisibility('collection-1', 'public')).rejects.toMatchObject({ message: 'db error' })
  })
})

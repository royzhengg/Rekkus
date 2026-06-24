-- B-607: Taxonomy V2 — re-parent south-asian under asian
-- south-asian was seeded as a root peer of asian (depth-2 constraint in B-600).
-- This migration makes it a child of asian so that searching "asian" expands to
-- Indian/Pakistani/Sri Lankan restaurants.
-- After: get_taxonomy_family('asian', 'cuisine') returns 20 nodes.
--
-- Safety: all DML + DDL runs in one explicit transaction.
-- Trigger DDL is transactional in Postgres; rollback reverts DISABLE TRIGGER automatically.
-- Idempotency: guard + all work share one DO block; RETURN exits the whole block.

begin;

  do $$
  declare
    v_already_done bool;
    v_path         text;
  begin
    -- Guard: RETURN exits this DO block entirely; nothing below runs on re-run
    select exists(
      select 1 from public.taxonomy_nodes n
      join public.taxonomy_nodes p on p.id = n.parent_id
      where n.slug = 'south-asian' and n.taxonomy_type = 'cuisine'
        and p.slug = 'asian'       and p.taxonomy_type = 'cuisine'
    ) into v_already_done;

    if v_already_done then
      raise notice 'B-607: south-asian already under asian — skipping';
      return;
    end if;

    -- Self-ref guard (defensive; these are clearly distinct nodes but verify)
    if (select id from public.taxonomy_nodes where slug = 'south-asian' and taxonomy_type = 'cuisine')
     = (select id from public.taxonomy_nodes where slug = 'asian'       and taxonomy_type = 'cuisine')
    then
      raise exception 'B-607: south-asian and asian resolve to the same id — aborting';
    end if;

    -- Temporarily disable immutability trigger so we can re-parent the node.
    -- Trigger state is part of the transaction; a rollback restores it.
    execute 'alter table public.taxonomy_nodes disable trigger taxonomy_nodes_immutable';

    -- Step 1: re-parent south-asian → asian; update materialised path
    update public.taxonomy_nodes
      set parent_id = (select id from public.taxonomy_nodes where slug = 'asian' and taxonomy_type = 'cuisine'),
          path      = 'asian/south-asian'
    where slug = 'south-asian' and taxonomy_type = 'cuisine';

    -- Step 2: update paths for all 5 direct children
    --   old: south-asian/indian   → new: asian/south-asian/indian
    --   (indian, sri-lankan, nepalese, pakistani, bangladeshi)
    update public.taxonomy_nodes
      set path = replace(path, 'south-asian/', 'asian/south-asian/')
    where taxonomy_type = 'cuisine'
      and path like 'south-asian/%';

    -- Re-enable immutability trigger
    execute 'alter table public.taxonomy_nodes enable trigger taxonomy_nodes_immutable';

    -- Spot-check: verify one child path and family membership
    select path into v_path
    from public.taxonomy_nodes
    where slug = 'indian' and taxonomy_type = 'cuisine';

    if v_path is distinct from 'asian/south-asian/indian' then
      raise exception 'B-607: unexpected path for indian: %, expected asian/south-asian/indian', v_path;
    end if;

    if not exists (
      select 1 from public.get_taxonomy_family('asian', 'cuisine')
      where get_taxonomy_family = 'indian'
    ) then
      raise exception 'B-607: indian not in get_taxonomy_family(asian) after re-parenting';
    end if;

    raise notice 'B-607: south-asian re-parented under asian. indian path = %', v_path;
  end $$;

commit;

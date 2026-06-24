import type { Database } from './database'

// Local key unions — intentionally not imported from database.aliases.ts to avoid circular dependency.
type TableKey    = keyof Database['public']['Tables']
type ViewKey     = keyof Database['public']['Views']
type FunctionKey = keyof Database['public']['Functions']

/** Top-level access to the public schema — useful for advanced generic work. */
export type DatabaseSchema = Database['public']

/** Usage: `TableRow<'places'>` */
export type TableRow<T extends TableKey>       = Database['public']['Tables'][T]['Row']
export type TableInsert<T extends TableKey>    = Database['public']['Tables'][T]['Insert']
export type TableUpdate<T extends TableKey>    = Database['public']['Tables'][T]['Update']
export type TableRelations<T extends TableKey> = Database['public']['Tables'][T]['Relationships']

export type ViewRow<T extends ViewKey>         = Database['public']['Views'][T]['Row']

export type RPCArgs<T extends FunctionKey>     = Database['public']['Functions'][T]['Args']
export type RPCReturns<T extends FunctionKey>  = Database['public']['Functions'][T]['Returns']

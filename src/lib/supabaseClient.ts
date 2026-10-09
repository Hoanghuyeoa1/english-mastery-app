/**
 * Legacy Supabase Test Stub
 * Retained strictly for backwards-compatibility with historical test fixtures.
 * All application runtime operations have cut over to ASP.NET Core Web API & SQL Server.
 */
export function isSupabaseConfigured(): boolean {
  return false;
}

export interface SupabaseMockClient {
  auth: {
    getUser: (options?: any) => Promise<{ data: { user: any }; error: any }>;
    getSession: () => Promise<{ data: { session: any }; error: any }>;
    onAuthStateChange: (...args: any[]) => { data: { subscription: { unsubscribe: () => void } } };
    signInWithPassword: (...args: any[]) => Promise<any>;
    signUp: (...args: any[]) => Promise<any>;
    signOut: () => Promise<any>;
    [key: string]: any;
  };
  from: (table: string, ...args: any[]) => any;
  rpc: (name: string, params?: any, ...args: any[]) => any;
  channel: (name: string, ...args: any[]) => any;
  removeChannel: (channel?: any) => void;
  [key: string]: any;
}

export const supabase: SupabaseMockClient = {
  auth: {
    getUser: async (_options?: any) => ({ data: { user: null }, error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: (..._args: any[]) => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: async (..._args: any[]) => ({ data: { user: null, session: null }, error: null }),
    signUp: async (..._args: any[]) => ({ data: { user: null, session: null }, error: null }),
    signOut: async () => ({ error: null }),
  },
  from: (table: string, ..._args: any[]) => ({
    select: (..._selectArgs: any[]) => ({
      eq: (..._eqArgs: any[]) => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      gt: (..._gtArgs: any[]) => ({ count: 0 }),
      order: (..._orderArgs: any[]) => ({ limit: (..._limitArgs: any[]) => ({ range: async () => ({ data: [], error: null, count: 0 }) }) }),
    }),
    upsert: async (..._args: any[]) => ({ data: null, error: null }),
    insert: async (..._args: any[]) => ({ data: null, error: null }),
    update: async (..._args: any[]) => ({ data: null, error: null }),
    delete: async (..._args: any[]) => ({ data: null, error: null }),
  }),
  rpc: async (name: string, params?: any, ..._args: any[]) => ({ data: null, error: null }),
  channel: (name: string, ..._args: any[]) => ({
    on: (..._onArgs: any[]) => ({ subscribe: (..._subArgs: any[]) => ({ unsubscribe: () => {} }) }),
  }),
  removeChannel: (_channel?: any) => {},
};

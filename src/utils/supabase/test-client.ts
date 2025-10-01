import fakeData from '../../../.insight/helpers/fake-data.json'

// Types for the fake client to match Supabase API
interface FakeQueryBuilder<T = any> {
    select(columns?: string): FakeQueryBuilder<T>
    eq(column: string, value: any): FakeQueryBuilder<T>
    or(filter: string): FakeQueryBuilder<T>
    is(column: string, value: any): FakeQueryBuilder<T>
    not(column: string, operator: string, value: any): FakeQueryBuilder<T>
    lte(column: string, value: any): FakeQueryBuilder<T>
    lt(column: string, value: any): FakeQueryBuilder<T>
    gte(column: string, value: any): FakeQueryBuilder<T>
    gt(column: string, value: any): FakeQueryBuilder<T>
    neq(column: string, value: any): FakeQueryBuilder<T>
    in(column: string, values: any[]): FakeQueryBuilder<T>
    like(column: string, pattern: string): FakeQueryBuilder<T>
    ilike(column: string, pattern: string): FakeQueryBuilder<T>
    match(query: Record<string, any>): FakeQueryBuilder<T>
    order(
        column: string,
        options?: { ascending?: boolean; nullsFirst?: boolean }
    ): FakeQueryBuilder<T>
    limit(count: number): FakeQueryBuilder<T>
    single(): Promise<{ data: T | null; error: any }>
    maybeSingle(): Promise<{ data: T | null; error: any }>
    then<TResult1 = T[], TResult2 = never>(
        onfulfilled?:
            | ((value: { data: T[]; error: any }) => TResult1 | PromiseLike<TResult1>)
            | undefined
            | null,
        onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
    ): Promise<TResult1 | TResult2>
}

interface FakeAuth {
    session(): Promise<{ data: { session: any } }>
    getSession(): Promise<{ data: { session: any } }>
    user(): Promise<{ data: { user: any } }>
    getUser(): Promise<{ data: { user: any } }>
    signInWithPassword(credentials: {
        email: string
        password: string
    }): Promise<{ data: { user: any; session: any }; error: any }>
    signOut(): Promise<{ error: any }>
    signUp(options: {
        email: string
        password: string
        options?: {
            emailRedirectTo?: string
            data?: any
        }
    }): Promise<{ data: { user: any; session: any }; error: any }>
    onAuthStateChange(callback: (event: string, session: any) => void): {
        data: { subscription: { unsubscribe: () => void } }
    }
}

interface FakeSupabaseClient {
    from(table: string): FakeQueryBuilder
    auth: FakeAuth
}

// Fake client implementation
export class FakeClient implements FakeSupabaseClient {
    private data: any
    private currentSession: any = null
    private authListeners: Array<(event: string, session: any) => void> = []

    constructor() {
        this.data = fakeData
        this.currentSession = this.data.session || null
    }

    from(table: string): FakeQueryBuilder {
        return new FakeQueryBuilder(this.data[table] || [], table)
    }

    private notifyAuthListeners(event: string, session: any) {
        this.authListeners.forEach((callback) => {
            try {
                callback(event, session)
            } catch (error) {
                console.error('Auth state change callback error:', error)
            }
        })
    }

    auth: FakeAuth = {
        session: () => this.currentSession,

        getSession: async () => ({
            data: {
                session: this.currentSession,
            },
        }),

        user: () => this.currentSession?.user,

        getUser: async () => ({
            data: {
                user: this.currentSession?.user,
            },
        }),

        signInWithPassword: async (credentials) => {
            // Simulate sign in - in real implementation you'd validate credentials
            const fakeUser = this.data.users?.find((u: any) => u.email === credentials.email) || {
                id: 'fake-user-id',
                email: credentials.email,
                created_at: new Date().toISOString(),
            }

            const session = {
                user: fakeUser,
                access_token: 'fake-access-token',
                refresh_token: 'fake-refresh-token',
                expires_at: Date.now() + 60 * 60 * 1000, // 1 hour
                token_type: 'bearer',
            }

            this.currentSession = session

            // Notify listeners
            setTimeout(() => {
                this.notifyAuthListeners('SIGNED_IN', session)
            }, 0)

            return {
                data: { user: fakeUser, session },
                error: null,
            }
        },

        signOut: async () => {
            const previousSession = this.currentSession
            this.currentSession = null

            // Notify listeners
            setTimeout(() => {
                this.notifyAuthListeners('SIGNED_OUT', null)
            }, 0)

            return { error: null }
        },

        signUp: async ({ email, password, options }) => {
            // Simulate sign up
            const newUser = {
                id: `fake-user-${Date.now()}`,
                email,
                created_at: new Date().toISOString(),
                user_metadata: options?.data || {},
            }

            const session = {
                user: newUser,
                access_token: 'fake-access-token',
                refresh_token: 'fake-refresh-token',
                expires_at: Date.now() + 60 * 60 * 1000,
                token_type: 'bearer',
            }

            this.currentSession = session

            // Notify listeners
            setTimeout(() => {
                this.notifyAuthListeners('SIGNED_UP', session)
            }, 0)

            return {
                data: { user: newUser, session },
                error: null,
            }
        },

        onAuthStateChange: (callback) => {
            this.authListeners.push(callback)

            // Immediately call with current session state
            setTimeout(() => {
                const event = this.currentSession ? 'INITIAL_SESSION' : 'SIGNED_OUT'
                callback(event, this.currentSession)
            }, 0)

            return {
                data: {
                    subscription: {
                        unsubscribe: () => {
                            const index = this.authListeners.indexOf(callback)
                            if (index > -1) {
                                this.authListeners.splice(index, 1)
                            }
                        },
                    },
                },
            }
        },
    }
}

class FakeQueryBuilder<T = any> implements FakeQueryBuilder<T> {
    private data: T[]
    private table: string
    private selectedColumns: string = '*'
    private filters: Array<{
        type:
            | 'eq'
            | 'or'
            | 'is'
            | 'not'
            | 'lte'
            | 'lt'
            | 'gte'
            | 'gt'
            | 'neq'
            | 'in'
            | 'like'
            | 'ilike'
        column: string
        value: any
        operator?: 'eq' | 'or' | 'is'
    }> = []
    private orderBy: { column: string; ascending: boolean; nullsFirst: boolean } | null = null
    private rowLimit: number | null = null

    constructor(data: T[], table: string) {
        this.data = Array.isArray(data) ? data : []
        this.table = table
    }

    select(columns: string = '*'): FakeQueryBuilder<T> {
        this.selectedColumns = columns
        return this
    }

    limit(count: number): FakeQueryBuilder<T> {
        this.rowLimit = count
        return this
    }

    eq(column: string, value: any): FakeQueryBuilder<T> {
        this.filters.push({ type: 'eq', column, value })
        return this
    }

    is(column: string, value: any): FakeQueryBuilder<T> {
        this.filters.push({ type: 'is', column, value })
        return this
    }

    or(filter: string): FakeQueryBuilder<T> {
        // Parse OR filter string like: "visibility.eq.public,user_id.eq.123"
        this.filters.push({ type: 'or', column: 'or', value: filter })
        return this
    }

    not(column: string, operator: 'eq' | 'or' | 'is', value: any): FakeQueryBuilder<T> {
        // Only support 'is' for now, matching Supabase .not(column, 'is', value)
        this.filters.push({ type: 'not', column, operator, value })
        return this
    }

    lte(column: string, value: any): FakeQueryBuilder<T> {
        this.filters.push({ type: 'lte', column, value })
        return this
    }

    lt(column: string, value: any): FakeQueryBuilder<T> {
        this.filters.push({ type: 'lt', column, value })
        return this
    }

    gte(column: string, value: any): FakeQueryBuilder<T> {
        this.filters.push({ type: 'gte', column, value })
        return this
    }

    gt(column: string, value: any): FakeQueryBuilder<T> {
        this.filters.push({ type: 'gt', column, value })
        return this
    }

    neq(column: string, value: any): FakeQueryBuilder<T> {
        this.filters.push({ type: 'neq', column, value })
        return this
    }

    in(column: string, values: any[]): FakeQueryBuilder<T> {
        this.filters.push({ type: 'in', column, value: values })
        return this
    }

    like(column: string, pattern: string): FakeQueryBuilder<T> {
        this.filters.push({ type: 'like', column, value: pattern })
        return this
    }

    ilike(column: string, pattern: string): FakeQueryBuilder<T> {
        this.filters.push({ type: 'ilike', column, value: pattern })
        return this
    }

    match(query: Record<string, any>): FakeQueryBuilder<T> {
        Object.entries(query).forEach(([column, value]) => {
            this.filters.push({ type: 'eq', column, value })
        })
        return this
    }

    order(
        column: string,
        options: { ascending?: boolean; nullsFirst?: boolean } = {}
    ): FakeQueryBuilder<T> {
        this.orderBy = {
            column,
            ascending: options.ascending ?? true,
            nullsFirst: options.nullsFirst ?? true,
        }
        return this
    }

    private applyFilters(data: T[]): T[] {
        return data.filter((item) => {
            // eq
            const eqFilters = this.filters.filter((f) => f.type === 'eq')
            for (const filter of eqFilters) {
                if ((item as any)[filter.column] !== filter.value) {
                    return false
                }
            }
            // neq
            const neqFilters = this.filters.filter((f) => f.type === 'neq')
            for (const filter of neqFilters) {
                if ((item as any)[filter.column] === filter.value) {
                    return false
                }
            }
            // lte
            const lteFilters = this.filters.filter((f) => f.type === 'lte')
            for (const filter of lteFilters) {
                if ((item as any)[filter.column] > filter.value) {
                    return false
                }
            }
            // lt
            const ltFilters = this.filters.filter((f) => f.type === 'lt')
            for (const filter of ltFilters) {
                if ((item as any)[filter.column] >= filter.value) {
                    return false
                }
            }
            // gte
            const gteFilters = this.filters.filter((f) => f.type === 'gte')
            for (const filter of gteFilters) {
                if ((item as any)[filter.column] < filter.value) {
                    return false
                }
            }
            // gt
            const gtFilters = this.filters.filter((f) => f.type === 'gt')
            for (const filter of gtFilters) {
                if ((item as any)[filter.column] <= filter.value) {
                    return false
                }
            }
            // in
            const inFilters = this.filters.filter((f) => f.type === 'in')
            for (const filter of inFilters) {
                if (
                    !Array.isArray(filter.value) ||
                    !filter.value.includes((item as any)[filter.column])
                ) {
                    return false
                }
            }
            // like
            const likeFilters = this.filters.filter((f) => f.type === 'like')
            for (const filter of likeFilters) {
                const val = (item as any)[filter.column]
                const regex = new RegExp('^' + filter.value.replace(/%/g, '.*') + '$')
                if (typeof val !== 'string' || !regex.test(val)) {
                    return false
                }
            }
            // ilike
            const ilikeFilters = this.filters.filter((f) => f.type === 'ilike')
            for (const filter of ilikeFilters) {
                const val = (item as any)[filter.column]
                const regex = new RegExp('^' + filter.value.replace(/%/g, '.*') + '$', 'i')
                if (typeof val !== 'string' || !regex.test(val)) {
                    return false
                }
            }
            // is
            const isFilters = this.filters.filter((f) => f.type === 'is')
            for (const filter of isFilters) {
                const itemValue = (item as any)[filter.column]
                if (filter.value === null && itemValue !== null) {
                    return false
                }
                if (filter.value !== null && itemValue !== filter.value) {
                    return false
                }
            }
            // NOT filters
            const notFilters = this.filters.filter((f) => f.type === 'not')
            for (const filter of notFilters) {
                const itemValue = (item as any)[filter.column]
                if (filter.operator === 'is') {
                    if (filter.value === null && itemValue === null) {
                        return false
                    }
                    if (filter.value !== null && itemValue === filter.value) {
                        return false
                    }
                }
            }
            // OR filters
            const orFilters = this.filters.filter((f) => f.type === 'or')
            if (orFilters.length === 0) return true
            for (const orFilter of orFilters) {
                const orConditions = orFilter.value.split(',')
                let orMatch = false
                for (const condition of orConditions) {
                    const [path, op, value] = condition.split('.')
                    if (op === 'eq' && (item as any)[path] === value) {
                        orMatch = true
                        break
                    }
                }
                if (!orMatch) return false
            }
            return true
        })
    }

    private applySorting(data: T[]): T[] {
        if (!this.orderBy) return data

        return [...data].sort((a, b) => {
            const aVal = (a as any)[this.orderBy!.column]
            const bVal = (b as any)[this.orderBy!.column]

            // Handle null values
            if (aVal === null && bVal === null) return 0
            if (aVal === null) return this.orderBy!.nullsFirst ? -1 : 1
            if (bVal === null) return this.orderBy!.nullsFirst ? 1 : -1

            // Compare values
            let comparison = 0
            if (aVal < bVal) comparison = -1
            else if (aVal > bVal) comparison = 1

            return this.orderBy!.ascending ? comparison : -comparison
        })
    }

    private selectColumns(item: T): any {
        if (this.selectedColumns === '*') return item

        const columns = this.selectedColumns.split(',').map((c) => c.trim())
        const result: any = {}

        for (const col of columns) {
            if (col in (item as any)) {
                result[col] = (item as any)[col]
            }
        }

        return result
    }

    async single(): Promise<{ data: T | null; error: any }> {
        try {
            let filtered = this.applyFilters(this.data)
            filtered = this.applySorting(filtered)
            if (this.rowLimit !== null) {
                filtered = filtered.slice(0, this.rowLimit)
            }
            const item = filtered.length > 0 ? filtered[0] : null

            return {
                data: item ? this.selectColumns(item) : null,
                error: null,
            }
        } catch (error) {
            return {
                data: null,
                error,
            }
        }
    }

    async maybeSingle(): Promise<{ data: T | null; error: any }> {
        try {
            let filtered = this.applyFilters(this.data)
            filtered = this.applySorting(filtered)
            if (this.rowLimit !== null) {
                filtered = filtered.slice(0, this.rowLimit)
            }
            // Supabase maybeSingle returns first row or null, but does not error if >1 row
            const item = filtered.length > 0 ? this.selectColumns(filtered[0]) : null
            return {
                data: item,
                error: null,
            }
        } catch (error) {
            return {
                data: null,
                error,
            }
        }
    }

    // Make it thenable so it can be awaited directly
    then<TResult1 = T[], TResult2 = never>(
        onfulfilled?:
            | ((value: { data: T[]; error: any }) => TResult1 | PromiseLike<TResult1>)
            | undefined
            | null,
        onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
    ): Promise<TResult1 | TResult2> {
        try {
            let filtered = this.applyFilters(this.data)
            filtered = this.applySorting(filtered)
            if (this.rowLimit !== null) {
                filtered = filtered.slice(0, this.rowLimit)
            }
            const selected = filtered.map((item) => this.selectColumns(item))

            const result = { data: selected, error: null }
            return Promise.resolve(result).then(onfulfilled, onrejected)
        } catch (error) {
            const result = { data: [], error }
            return Promise.resolve(result).then(onfulfilled, onrejected)
        }
    }
}

import { getSupabaseAdmin } from './supabase';

/**
 * Supabase adapter that mimics the MongoDB collection API used throughout the codebase.
 * This allows all existing routes to work with minimal changes â€” just replace the import.
 *
 * Automatically converts camelCase â†” snake_case so existing routes keep using camelCase
 * while Supabase PostgreSQL tables store snake_case columns.
 */

// Keys containing acronym runs (consecutive capitals) that the generic
// algorithm would mangle â€” e.g. "productSKUs" -> "product_s_k_us".
const CAMEL_TO_SNAKE_OVERRIDES: Record<string, string> = {
  productSKUs: 'product_skus',
  totalSGST: 'total_sgst',
  totalCGST: 'total_cgst',
  totalIGST: 'total_igst',
};

const SNAKE_TO_CAMEL_OVERRIDES: Record<string, string> = Object.fromEntries(
  Object.entries(CAMEL_TO_SNAKE_OVERRIDES).map(([camel, snake]) => [snake, camel])
);

function toSnakeCase(str: string): string {
  const override = CAMEL_TO_SNAKE_OVERRIDES[str];
  if (override) return override;
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

function toCamelCase(str: string): string {
  const override = SNAKE_TO_CAMEL_OVERRIDES[str];
  if (override) return override;
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function convertKeysToSnake(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof RegExp) return obj;
  if (Array.isArray(obj)) return obj.map(convertKeysToSnake);
  if (typeof obj !== 'object') return obj;

  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip MongoDB-specific operators ($set, $unset, $pull, $push, etc.)
    if (key.startsWith('$')) {
      result[key] = value;
    } else {
      result[toSnakeCase(key)] = convertKeysToSnake(value);
    }
  }
  return result;
}

function convertKeysToCamel(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof RegExp) return obj;
  if (Array.isArray(obj)) return obj.map(convertKeysToCamel);
  if (typeof obj !== 'object') return obj;

  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    result[toCamelCase(key)] = convertKeysToCamel(value);
  }
  return result;
}

function convertSort(sortObj: any): { column: string; ascending: boolean }[] {
  if (!sortObj) return [];
  return Object.entries(sortObj).map(([key, val]) => ({
    column: toSnakeCase(key),
    ascending: val === 1,
  }));
}

function applySupabaseFilters(query: any, filter: any) {
  if (!filter || Object.keys(filter).length === 0) return query;

  for (const [key, value] of Object.entries(filter)) {
    if (value === null) {
      query = query.is(key, null);
    } else if (value instanceof RegExp) {
      // Case-insensitive exact match (Mongo-style anchored regex)
      const source = value.source.replace(/^\^/, '').replace(/\$$/, '');
      query = query.ilike(key, source);
    } else if (typeof value === 'object' && value !== null) {
      const v = value as any;
      if ('$in' in v) {
        query = query.in(key, v.$in);
      } else if ('$contains' in v) {
        // Postgres array column contains element(s)
        query = query.contains(key, Array.isArray(v.$contains) ? v.$contains : [v.$contains]);
      } else if ('$ne' in v) {
        query = query.neq(key, v.$ne);
      } else if ('$gte' in v) {
        query = query.gte(key, v.$gte);
      } else if ('$lte' in v) {
        query = query.lte(key, v.$lte);
      } else if ('$gt' in v) {
        query = query.gt(key, v.$gt);
      } else if ('$lt' in v) {
        query = query.lt(key, v.$lt);
      } else if ('$regex' in v) {
        const source = typeof v.$regex === 'string'
          ? v.$regex.replace(/^\^/, '').replace(/\$$/, '')
          : String(v.$regex);
        query = query.ilike(key, `%${source}%`);
      }
    } else {
      query = query.eq(key, value);
    }
  }
  return query;
}

function createCursor(tableName: string, filter: any = {}) {
  const snakeFilter = convertKeysToSnake(filter);
  let query = (getSupabaseAdmin() as any).from(tableName).select('*');
  query = applySupabaseFilters(query, snakeFilter);

  let offsetVal = 0;
  let limitVal: number | null = null;
  let executed: Promise<any[]> | null = null;

  const exec = (): Promise<any[]> => {
    if (!executed) {
      let finalQuery = query;
      if (limitVal !== null && limitVal > 0) {
        finalQuery = finalQuery.range(offsetVal, offsetVal + limitVal - 1);
      } else if (offsetVal > 0) {
        finalQuery = finalQuery.range(offsetVal, undefined as any);
      }
      const run = async () => {
        const { data }: any = await finalQuery;
        return (data || []).map(convertKeysToCamel);
      };
      executed = run();
    }
    return executed;
  };

  const cursor: any = {
    sort(sortObj: any) {
      if (sortObj) {
        for (const s of convertSort(sortObj)) {
          query = query.order(s.column, { ascending: s.ascending });
        }
      }
      return cursor;
    },
    skip(n: number) {
      offsetVal = n;
      return cursor;
    },
    limit(n: number) {
      limitVal = n;
      return cursor;
    },
    toArray() {
      return exec();
    },
    [Symbol.asyncIterator]() {
      let items: any[] | null = null;
      let index = 0;
      return {
        async next(): Promise<IteratorResult<any>> {
          if (items === null) items = await exec();
          if (index < items.length) {
            return { value: items[index++], done: false };
          }
          return { value: undefined as any, done: true };
        },
      };
    },
  };

  return cursor;
}

function collectionShim(tableName: string) {
  return {
    find(filter: any = {}) {
      return createCursor(tableName, filter);
    },

    async findOne(filter: any = {}) {
      const snakeFilter = convertKeysToSnake(filter);
      let query = (getSupabaseAdmin() as any).from(tableName).select('*').limit(1);
      query = applySupabaseFilters(query, snakeFilter);
      const { data } = await query;
      if (!data || data.length === 0) return null;
      return convertKeysToCamel(data[0]);
    },

    async countDocuments(filter: any = {}) {
      const snakeFilter = convertKeysToSnake(filter);
      let query = (getSupabaseAdmin() as any).from(tableName).select('*', { count: 'exact', head: true });
      query = applySupabaseFilters(query, snakeFilter);
      const { count } = await query;
      return count || 0;
    },

    async insertOne(doc: any) {
      const snakeDoc = convertKeysToSnake(doc);
      const { data, error } = await (getSupabaseAdmin() as any).from(tableName).insert(snakeDoc).select().single();
      if (error) throw new Error(error.message);
      return { insertedId: doc.id || data?.id, ops: [data] };
    },

    async insertMany(docs: any[]) {
      const snakeDocs = docs.map(convertKeysToSnake);
      const { data, error } = await (getSupabaseAdmin() as any).from(tableName).insert(snakeDocs).select();
      if (error) throw new Error(error.message);
      return { insertedCount: docs.length, insertedIds: docs.map(d => d.id) };
    },

    async updateOne(filter: any, update: any) {
      const snakeFilter = convertKeysToSnake(filter);

      // Build the update payload once
      let setPayload: any = {};
      if (update.$set) {
        setPayload = convertKeysToSnake({ ...update.$set });
      } else {
        setPayload = convertKeysToSnake({ ...update });
      }
      if (update.$unset) {
        for (const key of Object.keys(update.$unset)) {
          setPayload[toSnakeCase(key)] = null;
        }
      }
      // Remove undefined values
      Object.keys(setPayload).forEach(key => {
        if (setPayload[key] === undefined) delete setPayload[key];
      });

      const upsertMissing = async () => {
        if (update.$set) {
          const newDoc = convertKeysToSnake({ ...update.$set, ...snakeFilter });
          if (update.$unset) {
            for (const key of Object.keys(update.$unset)) {
              newDoc[toSnakeCase(key)] = null;
            }
          }
          const { data, error } = await (getSupabaseAdmin() as any).from(tableName).upsert(newDoc, { onConflict: 'id' }).select();
          if (error) throw new Error(error.message);
          return { matchedCount: 1, modifiedCount: 1, upsertedId: newDoc.id };
        }
        return { matchedCount: 0, modifiedCount: 0 };
      };

      let recordId: string | undefined = snakeFilter?.id;

      if (!recordId) {
        // Non-id filter: find the record first, then update by id
        let selectQuery: any = (getSupabaseAdmin() as any).from(tableName).select('id').limit(1);
        selectQuery = applySupabaseFilters(selectQuery, snakeFilter);
        const { data: existing } = await selectQuery;
        if (!existing || existing.length === 0) {
          return upsertMissing();
        }
        recordId = existing[0].id;
      }

      // Single round trip: update by id and ask for the affected ids back.
      const { data: updated, error } = await (getSupabaseAdmin() as any)
        .from(tableName)
        .update(setPayload)
        .eq('id', recordId)
        .select('id');
      if (error) throw new Error(error.message);

      if (!updated || updated.length === 0) {
        return upsertMissing();
      }

      return { matchedCount: 1, modifiedCount: 1 };
    },

    async updateMany(filter: any, update: any) {
      const snakeFilter = convertKeysToSnake(filter);
      // Select full rows so $pull can read and rewrite array columns
      let selectQuery: any = (getSupabaseAdmin() as any).from(tableName).select('*');
      selectQuery = applySupabaseFilters(selectQuery, snakeFilter);
      const { data: records } = await selectQuery;

      if (!records || records.length === 0) {
        return { matchedCount: 0, modifiedCount: 0 };
      }

      let updateData: any = {};
      if (update.$set) {
        updateData = convertKeysToSnake(update.$set);
      } else if (update.$pull) {
        // For $pull on arrays, we need to handle each record
        for (const record of records) {
          for (const [field, value] of Object.entries(update.$pull)) {
            const snakeField = toSnakeCase(field);
            const currentArray = record[snakeField] || [];
            const newArray = currentArray.filter((v: any) => v !== value);
            await (getSupabaseAdmin() as any).from(tableName).update({ [snakeField]: newArray }).eq('id', record.id);
          }
        }
        return { matchedCount: records.length, modifiedCount: records.length };
      } else {
        updateData = convertKeysToSnake(update);
      }

      // Update all matching records
      for (const record of records) {
        const { error } = await (getSupabaseAdmin() as any).from(tableName).update(updateData).eq('id', record.id);
        if (error) throw new Error(error.message);
      }

      return { matchedCount: records.length, modifiedCount: records.length };
    },

    async deleteOne(filter: any) {
      const snakeFilter = convertKeysToSnake(filter);
      let query: any = (getSupabaseAdmin() as any).from(tableName).delete();
      query = applySupabaseFilters(query, snakeFilter);
      const { data, error } = await query.select('id');
      if (error) throw new Error(error.message);
      return { deletedCount: (data || []).length };
    },

    async deleteMany(filter: any) {
      const snakeFilter = convertKeysToSnake(filter);
      let query: any = (getSupabaseAdmin() as any).from(tableName).delete();
      query = applySupabaseFilters(query, snakeFilter);
      const { data, error } = await query.select('id');
      if (error) throw new Error(error.message);
      return { deletedCount: (data || []).length };
    },
  };
}

// Simulate the MongoDB db object
const db = {
  collection: (name: string) => collectionShim(name),
};

export async function connectToDatabase() {
  return { db };
}

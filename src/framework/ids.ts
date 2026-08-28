/**
 * Typed custom IDs.
 *
 * Discord gives us one 100-character string to carry state from a component back
 * to its handler. Parsing that string by hand means the code that mints the ID
 * and the code that reads it have no contract. This makes it a typed one.
 */

export interface ParamCodec<T> {
    parse(raw: string): T;
    format(value: T): string;
}

const SEP = ":";

/** Escaped so string params may contain the separator. */
const escape = (value: string) => value.replace(/%/g, "%25").replace(/:/g, "%3A");
const unescape = (value: string) => value.replace(/%3A/g, ":").replace(/%25/g, "%");

export class IdError extends Error {}

export const Str: ParamCodec<string> = {
    parse: unescape,
    format: escape
};

export const Num: ParamCodec<number> = {
    parse(raw) {
        const value = Number(raw);
        if (!Number.isFinite(value)) throw new IdError(`expected a number, got ${JSON.stringify(raw)}`);
        return value;
    },
    format: value => String(value)
};

export const Bool: ParamCodec<boolean> = {
    parse: raw => raw === "1",
    format: value => value ? "1" : "0"
};

/** A snowflake, validated on the way out and on the way back in. */
export const Id: ParamCodec<string> = {
    parse(raw) {
        if (!/^\d{15,25}$/.test(raw)) throw new IdError(`expected a snowflake, got ${JSON.stringify(raw)}`);
        return raw;
    },
    format(value) {
        if (!/^\d{15,25}$/.test(value)) throw new IdError(`${JSON.stringify(value)} is not a snowflake`);
        return value;
    }
};

/** Produces a literal union, so a switch over the param can be exhaustive. */
export function oneOf<const T extends readonly string[]>(...allowed: T): ParamCodec<T[number]> {
    return {
        parse(raw) {
            if (!allowed.includes(raw)) throw new IdError(`expected one of ${allowed.join("|")}, got ${JSON.stringify(raw)}`);
            return raw;
        },
        format: value => value
    };
}

/**
 * `ParamCodec<T>` is invariant in T (it both produces and consumes a T), so no
 * single `ParamCodec<X>` is a supertype of all codecs. This is the supertype:
 * produces `unknown`, consumes `never`. Constraint position only — at each
 * definition site the concrete codec types are still inferred.
 */
export interface AnyParamCodec {
    parse(raw: string): unknown;
    format(value: never): string;
}

export type ParamSpec = Record<string, AnyParamCodec>;
export type Params<S extends ParamSpec> = {[K in keyof S]: S[K] extends ParamCodec<infer T> ? T : never};

/** Discord's hard limit on custom_id. Better to fail here than at send time. */
export const MAX_CUSTOM_ID = 100;

export function encodeId<S extends ParamSpec>(namespace: string, spec: S, params: Params<S>): string {
    const values = params as Record<string, never>;
    const parts = [namespace];
    for (const key of Object.keys(spec)) parts.push(spec[key].format(values[key]));

    const id = parts.join(SEP);
    if (id.length > MAX_CUSTOM_ID) {
        throw new IdError(`custom id for "${namespace}" is ${id.length} chars (max ${MAX_CUSTOM_ID}). Store the payload and reference it by key instead.`);
    }
    return id;
}

export function decodeId<S extends ParamSpec>(spec: S, raw: string): Params<S> {
    const [, ...values] = raw.split(SEP);
    const keys = Object.keys(spec);
    if (values.length !== keys.length) {
        throw new IdError(`expected ${keys.length} params, got ${values.length} in ${JSON.stringify(raw)}`);
    }

    const parsed: Record<string, unknown> = {};
    keys.forEach((key, index) => {parsed[key] = spec[key].parse(values[index]);});
    return parsed as Params<S>;
}

export const namespaceOf = (raw: string): string => raw.split(SEP, 1)[0];

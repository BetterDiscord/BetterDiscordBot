const isFalseOrNullish = (value: unknown) => value === false || value == null;
const isNotFalseOrNullish = (value: unknown) => !isFalseOrNullish(value);

export function transformChildrenArray<T>(children: Array<T | T[]>): T[] {
    return children.flat(Infinity).filter(isNotFalseOrNullish) as T[];
}

export function childrenToString(name: string, children: string | string[] | null): string | null {
    if (Array.isArray(children)) {
        return transformChildrenArray(children).join("");
    }
    if (typeof children === "string") {
        return children;
    }
    if (isFalseOrNullish(children)) {
        return null;
    }
    throw new Error(`${name} children must be a string or an array of strings`);
}

export function childrenToArray<T>(children: T | T[]): T[] {
    if (Array.isArray(children)) {
        return transformChildrenArray(children);
    }
    if (isFalseOrNullish(children)) {
        return [];
    }
    return [children];
}

export function singleChild<T>(name: string, children: T | T[]): T {
    if (!Array.isArray(children)) return children;
    if (Array.isArray(children) && children.length !== 1) {
        throw new Error(`${name} must have exactly one child`);
    }

    return children[0];
}
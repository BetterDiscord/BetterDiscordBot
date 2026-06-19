/**
 * This system provides a minimal JSX runtime for creating component structures.
 * It supports basic elements like line breaks and fragments, as well as function components.
 *
 * It was adapted from Venbot with permission https://github.com/Vencord/venbot/blob/main/LICENSE
 */

export const Fragment = Symbol("ComponentsJsx.Fragment");

type FunctionComponent<P, R> = (props: P) => R;

export function createElement<P extends {children?: unknown;}, R>(type: "br" | typeof Fragment | FunctionComponent<P, R>, props: P, ...children: Array<P["children"]>): R {

    // Normalize props and children
    props ??= {} as P;
    if (children.length > 0) props.children = children;

    switch (type) {
        case "br":
            return "\n" as R;
        case Fragment:
            return props.children as R;
    }

    return type(props);
}

export const jsx = createElement;
export const jsxs = createElement;
export const jsxDEV = createElement;

// function logAndReturn(name: string) {
//     return (type, props, ...children) => {
//         console.log(name, "called");
//         console.log("createElement called with type:", type, "props:", props, "children:", children);
//         return createElement(type, props, ...children);
//     };
// }

// export const jsx = logAndReturn("jsx");
// export const jsxs = logAndReturn("jsxs");
// export const jsxDEV = logAndReturn("jsxDEV");
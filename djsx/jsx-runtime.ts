/**
 * This system provides a minimal JSX runtime for creating component structures.
 * It supports basic elements like line breaks and fragments, as well as function components.
 *
 * It was adapted from Venbot with permission https://github.com/Vencord/venbot/blob/main/LICENSE
 */

export const Fragment = Symbol("ComponentsJsx.Fragment");

type FunctionComponent<P, K> = (props: P) => K;

export function createElement<P extends {children?: unknown;}, K>(type: "br" | typeof Fragment | FunctionComponent<P, K>, props: P, ...children: Array<P["children"]>): K {

    // Normalize props and children
    props ??= {} as P;
    if (children.length > 0) props.children = children;

    switch (type) {
        case "br":
            return "\n" as K;
        case Fragment:
            return props.children as K;
    }

    return type(props);
}

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

export const jsx = createElement;
export const jsxs = createElement;
export const jsxDEV = createElement;
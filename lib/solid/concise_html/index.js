// spec
// element := tag | attr[] | children[]
// tag := string
// attr := {key:value}
// children := element
//
// doc starts with element
// if attrs, they start with [], inside which are key value pairs separated by =
// if text starts with --
// if text is multiline, then will start with --- and end with ---
// children based on indentation
import { each, h as f, if_then } from "../monke.js";
export function hh(strings, ...values) {
    // make them one array
    let arr = strings.reduce((acc, str, i) => {
        //@ts-ignore
        acc.push(str);
        if (values[i]) {
            //@ts-ignore
            acc.push({ value: values[i], type: "expression" });
        }
        return acc;
    }, []);
    let parser = new Parser(arr);
    let ast = parser.parse();
    return ast;
}
export function h(strings, ...values) {
    // make them one array
    let arr = strings.reduce((acc, str, i) => {
        //@ts-ignore
        acc.push(str);
        if (values[i]) {
            //@ts-ignore
            acc.push({ value: values[i], type: "expression" });
        }
        return acc;
    }, []);
    let parser = new Parser(arr);
    let ast = parser.parse();
    return converAstToHyperscript(ast);
}
// imagine this is hyperscript for now, you can use
// hyper("div", { class: "container" }, [p("hello", "world")])
let hyper = f;
function converAstToHyperscript(ast) {
    let ret = [];
    ast.forEach((element) => {
        let children = element.children.length > 0
            ? converAstToHyperscript(element.children)
            : [];
        if (element.tag == "text" || element.tag == "expression") {
            //@ts-ignore
            ret.push(element.value);
        } // if tag is each, use the of and children to make each element from solid js
        else if (element.tag == "each") {
            let of = element.children.find((child) => child.tag === "of");
            let children = element.children.find((child) =>
                child.tag === "children" || child.tag === "as"
            );
            if (
                of && children &&
                (of === null || of === void 0 ? void 0 : of.value) &&
                (children === null || children === void 0
                    ? void 0
                    : children.value)
            ) {
                let e = () => each(of.value, children.value);
                ret.push(e);
            } else {
                let f = of === null || of === void 0
                    ? void 0
                    : of.children.find((e) => e.tag === "expression");
                let c = children === null || children === void 0
                    ? void 0
                    : children.children.find((e) => e.tag === "expression");
                if (!f || !c) {
                    throw new Error("Invalid each block");
                }
                let e = () => each(f.value, c.value);
                ret.push(e);
            }
        } else if (element.tag == "when") {
            let w = element.children.find((e) => e.tag === "condition");
            let t = element.children.find((e) => e.tag === "then");
            if (!w || !t) {
                throw new Error("Invalid when block");
            }
            let e = () => if_then({ if: w.value, then: t.value });
            ret.push(e);
        } else {
            ret.push(hyper(element.tag, element.attrs, children));
        }
    });
    return ret;
}
class Parser {
    constructor(data) {
        this.data = data;
        this.index = 0;
        this.current = this.data[this.index];
        this.ast = [];
        this.cursor = 0;
    }
    peekNext() {
        if (this.index >= this.data.length) {
            return undefined;
        } else {
            let i = this.index;
            let peek = i + 1;
            let peeked = this.data[peek];
            return peeked;
        }
    }
    ended() {
        if (!this.char() && !this.peekNext()) {
            return true;
        } else {
            return false;
        }
    }
    next() {
        if (this.index >= this.data.length) {
            return undefined;
        } else {
            this.index++;
            this.current = this.data[this.index];
            this.cursor = 0;
            return this.current;
        }
    }
    recursivelyCheckChildrenIndentAndAdd(element, last) {
        let compare = last;
        while (compare.children.length > 0) {
            let compareBuffer = compare.children[compare.children.length - 1];
            if (!compareBuffer) {
                break;
            }
            if (element.indent > compareBuffer.indent) {
                compare = compareBuffer;
            } else {
                break;
            }
        }
        compare.children.push(element);
    }
    parse() {
        while (!this.ended()) {
            let element = this.parseElement();
            let ast_last = this.ast[this.ast.length - 1];
            if (element) {
                if (ast_last && element.indent > ast_last.indent) {
                    this.recursivelyCheckChildrenIndentAndAdd(
                        element,
                        ast_last,
                    );
                } else {
                    this.ast.push(element);
                }
            } else {
                break;
            }
        }
        return this.ast;
    }
    parseElement() {
        let indent = 0;
        let tag = "";
        let attrs = {};
        let children = [];
        if (this.ended()) {
            return undefined;
        }
        if (typeof this.current === "string") {
            indent = this.parseIndent();
        }
        if (typeof this.current === "string") {
            this.eatEmpty();
            tag = this.parseTag();
            if (tag === "") {
                return undefined;
            }
        } else if (this.current.type === "expression") {
        }
        attrs = this.parseAttrs();
        if (tag === "when" || tag === "each") {
            if (tag === "each") {
                children = this.parseEach(indent);
            }
            if (tag === "when") {
                children = this.parseWhen(indent);
            }
        } else {
            children = this.parseText();
        }
        if (tag === "#each") {
            tag = "each";
        }
        return {
            tag,
            attrs,
            children,
            indent,
        };
    }
    // pattern -> when [expression] then [expression]
    parseWhen(indent = 0) {
        let when = this.next();
        if (when === undefined) {
            throw new Error(
                "Invalid when [when]: WHEN needs to be an expression",
            );
        }
        if (typeof when !== "string") {
            if (when.type !== "expression") {
                throw new Error(
                    "Invalid when [when]: WHEN needs to be an expression",
                );
            }
        } else {
            throw new Error("Invalid when [when]: WHEN cannot be string");
        }
        let then = this.next();
        if (then === undefined) {
            throw new Error(
                "Invalid when [then]: THEN needs to be an expression",
            );
        }
        if (typeof then == "string") {
            if (then.trim() !== "then") {
                throw new Error(
                    "Invalid when [then]: THEN needs to be an expression",
                );
            }
        } else {
            throw new Error("Invalid when [then]: THEN cannot be string");
        }
        let value = this.next();
        if (value === undefined) {
            throw new Error("Invalid when block");
        }
        if (value.type !== "expression") {
            throw new Error(
                "Invalid when [when]: WHEN needs to be an expression",
            );
        }
        let next = this.next();
        if (next === undefined) {}
        else {
            this.eatWhitespace();
        }
        return [
            {
                tag: "condition",
                value: when.value,
                attrs: {},
                children: [],
                indent: indent + 2,
            },
            {
                tag: "then",
                value: value.value,
                attrs: {},
                children: [],
                indent: indent + 2,
            },
        ];
    }
    // ** If this is called, then we are sure that the tag is "each"
    // the pattern should be -> each [expression] as [expression]
    // if its not this we fail
    // if it is, we create a each block with children elements tag with of and children
    parseEach(indent = 0) {
        let of = this.next();
        if (of === undefined) {
            throw new Error("Invalid each [of]: OF needs to be an expression");
        }
        if (typeof of !== "string") {
            if (of.type !== "expression") {
                throw new Error(
                    "Invalid each [of]: OF needs to be an expression",
                );
            }
        } else {
            throw new Error("Invalid each [of]: OF cannot be string");
        }
        let ofValue = this.next();
        if (ofValue === undefined) {
            throw new Error("invalid each of [as]: as keyword missing");
        }
        // this needs to be string => "as"
        if (typeof ofValue === "string") {
            if (ofValue.trim() !== "as") {
                throw new Error("invalid each of [as]: as keyword missing");
            }
        } else {
            throw new Error("ofValue is not a string");
        }
        let asValue = this.next();
        if (asValue === undefined) {
            throw new Error("Invalid each block");
        }
        if (typeof asValue.value !== "function") {
            throw new Error("Invalid d");
        }
        let next = this.next();
        if (next === undefined) {}
        else {
            this.eatWhitespace();
        }
        return [
            {
                tag: "of",
                value: of.value,
                attrs: {},
                children: [],
                indent: indent + 2,
            },
            {
                tag: "children",
                value: asValue.value,
                attrs: {},
                children: [],
                indent: indent + 2,
            },
        ];
    }
    parseSingleLineText() {
        let ret = [];
        let text = "";
        while (this.char() !== `\n`) {
            // if this.char() === undefined, then we have reached the end of the string
            // if next is expression, add text to ret, then add expression and keep going till terminated by \n
            if (this.char() === undefined) {
                ret.push(this.makeTextElement(text));
                text = "";
                let next = this.next();
                if (next === undefined) {
                    break;
                }
                if (typeof next !== "string") {
                    ret.push(this.makeExpressionElement(next.value));
                    this.next();
                }
            } else {
                text += this.eat();
            }
        }
        if (text !== "") {
            ret.push(this.makeTextElement(text));
        }
        return ret;
    }
    lookAhead(n = 1) {
        let c = this.cursor;
        let current = this.current;
        return current[c + n];
    }
    isThreeHyphens() {
        return this.lookAhead(0) === "-" && this.lookAhead(1) === "-" &&
            this.lookAhead(2) === "-";
    }
    parseMultiLineText() {
        let ret = [];
        let text = "";
        while (!this.isThreeHyphens()) {
            if (this.char() === undefined) {
                ret.push(this.makeTextElement(text));
                text = "";
                let next = this.next();
                if (next === undefined) {
                    break;
                }
                if (typeof next !== "string") {
                    ret.push(this.makeExpressionElement(next.value));
                    this.next();
                }
            } else {
                text += this.eat();
            }
        }
        if (this.isThreeHyphens()) {
            this.eat();
            this.eat();
            this.eat();
        }
        if (text !== "") {
            ret.push(this.makeTextElement(text));
        }
        return ret;
    }
    parseText() {
        let ret = [];
        this.eatWhitespace();
        if (this.char() === "-") {
            this.eat();
            if (this.char() === "-") {
                if (this.lookAhead() === "-") {
                    this.eat();
                    this.eat();
                    this.eatWhitespace();
                    ret = this.parseMultiLineText();
                } else {
                    this.eat();
                    this.eatWhitespace();
                    ret = this.parseSingleLineText();
                }
            }
        }
        return ret;
    }
    makeExpressionElement(value) {
        return {
            tag: "expression",
            children: [],
            indent: 0,
            attrs: {},
            value,
        };
    }
    makeTextElement(value) {
        return {
            tag: "text",
            children: [],
            indent: 0,
            attrs: {},
            value,
        };
    }
    eatWhitespace() {
        while (this.current[this.cursor] === " ") {
            this.cursor++;
        }
    }
    eatNewline() {}
    eatEmpty() {
        while (
            this.char() === " " || this.char() === "\n" || this.char() === "\t"
        ) {
            this.eat();
        }
    }
    char() {
        return this.current ? this.current[this.cursor] : undefined;
    }
    eat() {
        let char = this.current[this.cursor];
        this.cursor++;
        return char;
    }
    parseAttrs() {
        this.eatWhitespace();
        if (this.current[this.cursor] !== "[") {
            return {};
        } else {
            let attrs = {};
            this.cursor++;
            this.eatEmpty();
            while (this.char() !== "]") {
                let key = "";
                let value = "";
                this.eatEmpty();
                if (this.char() === undefined) {
                    let next = this.next();
                    if (next === undefined) {
                        throw new Error("Invalid attribute");
                    }
                    if (typeof next !== "string") {
                        key = next.value;
                        this.next();
                        if (this.char() === "=") {
                            this.eat();
                        } else {
                            throw new Error("Should have =");
                        }
                    } else {
                        key = this.parseKey();
                    }
                } else {
                    key = this.parseKey();
                }
                this.eatEmpty();
                if (this.char() === undefined) {
                    let next = this.next();
                    if (next === undefined) {
                        throw new Error("Invalid attribute");
                    }
                    if (typeof next !== "string") {
                        value = next.value;
                        this.next();
                    } else {
                        value = this.parseValue();
                    }
                } else {
                    value = this.parseValue();
                }
                this.eatEmpty();
                attrs[key] = value;
            }
            this.eat();
            return attrs;
        }
    }
    parseKey() {
        let key = "";
        this.eatWhitespace();
        while (this.char() !== "=" && this.current.length > this.cursor) {
            key += this.eat();
        }
        this.eat();
        this.eatWhitespace();
        return key.trim();
    }
    parseValue() {
        let value = "";
        this.eatWhitespace();
        while (this.char() !== " ") {
            if (this.char() === undefined) {
                break;
            }
            if (this.char() === "]") {
                this.eat;
                break;
            }
            value += this.eat();
        }
        this.eatWhitespace();
        return value.trim();
    }
    parseIndent() {
        let i = 0;
        while (
            this.char() === " " || this.char() === "\t" || this.char() === "\n"
        ) {
            if (this.char() === " ") {
                i++;
            }
            if (this.char() === "\t") {
                i += 2;
            }
            if (this.char() === "\n") {
                i = 0;
            }
            this.cursor++;
        }
        return i;
    }
    parseTag() {
        let tag = "";
        while (
            this.char() !== " " && this.char() !== "\n" &&
            this.char() !== "\t" && this.char() !== "[" &&
            this.char() !== undefined
        ) {
            tag += this.eat();
        }
        return tag;
    }
    cursorCheck() {
        if (this.cursor >= this.current.length) {
            this.next();
        }
    }
}

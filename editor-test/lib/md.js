import markdownIt from "./markdown-it/markdown-it.js";
import makrdownItMark from "./markdown-it/markdown-it-mark.js";
import { h } from "./solid/monke.js"

// ********************************
// SECTION : MARKDOWN RENDERING
// ********************************
let md = new markdownIt().use(makrdownItMark);

let attrs = (item) => {
	let attrs = item.attrs;
	if (!attrs) return "";
	return Object.fromEntries(attrs);
};

const deault_processor = (tag, attrs, children) => {
	return h(tag, attrs, children)
}

const default_softbreak = h("br")


function eat(tree, processor = deault_processor, softbreak = default_softbreak) {
	let ret = [];

	if (!tree) return "";

	while (tree.length > 0) {
		let item = tree.shift();

		if (item.nesting === 1) {
			let at = attrs(item);
			let children = eat(tree);

			ret.push(processor(item.tag, at, children));
		}

		if (item.nesting === 0) {
			if (!item.children || item.children.length === 0) {
				let p = item.type === "softbreak" ? softbreak : item.content;
				ret.push(p);
			} else {
				let children = eat(item.children);
				ret.push(children);
			}
		}

		if (item.nesting === -1) break;
	}

	return ret;
}

let safe_parse = (content) => {
	try {
		return md.parse(content, { html: true });
	} catch (e) {
		return undefined;
	}
};

export const MD = (content) => {
	let tree = safe_parse(content);

	let body;

	if (tree) body = eat(tree);
	else body = content;

	return body;
};

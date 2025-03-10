// -------------
// Solid Imports
// -------------
import {
	batch,
	each,
	eff_on,
	h,
	mem,
	mounted,
	produce,
	render,
	sig,
	store,
} from "/lib/solid/monke.js";

import { Keymanager } from "/lib/keymanager.js";
import { createEnvironment } from "/lib/ts/ts.js";

// -------------
// Codemirror Imports
// -------------
import {
	basicSetup,
	EditorState,
	autocompletion,
	linter,
	EditorView,
	HighlightStyle,
	javascript,
	keymap,
	syntaxHighlighting,
	t,
	completeFromList,
	Vim,
	vim,
} from "/lib/codemirror/bundled.js";

// -------------
// UTILITIES
// -------------

let CURRENT_PATH = sig("");
const m = () => { return iframe_ref()?.contentDocument.M }

// -------------
let iframe_ref = sig(null)

eff_on(iframe_ref, () => {
	if (iframe_ref()) {
		console.log("ref was set", iframe_ref())
		console.log("SETTING EDITOR")
		if (m()) m().EDITOR = editor
	}
})

// -------------

const uid = () => Math.random().toString(36).substring(7);

const throttle = (fn, delay) => {
	let timerFlag = null;
	return (...args) => {
		if (timerFlag === null) {
			fn(...args);
			timerFlag = setTimeout(() => timerFlag = null, delay);
		}
	};
}

function defer(fn, t = 10) { setTimeout(fn, t); }

function eval_code(code) {
	return eval(`"use strict";(${code})`);
}

// =============
// CORE
// =============
class RendererList {
	constructor() {
		const [renderers, set_renderers] = store({});
		this.renderers = renderers;
		this.set_renderers = set_renderers;
	}

	register(type, fn) {
		this.set_renderers(type, fn);
	}

	/**
	 * @param {string} type
	 * @returns {(() => View) | null}
	 */
	find(type) {
		const fn_str = this.renderers[type];
		const fn = eval_code(fn_str);
		if (typeof fn == "function") return fn;
		else return null
	}
}

class State {
	constructor({ type, blocks, parent, cursor, id, tsserver }) {
		const _blocks = blocks ? blocks : [];
		const _type = type ? type : "default";
		const _id = id ? id : uid();

		const [model, update] = store({
			blocks: _blocks,
			output: "",
		});

		this.id = _id;
		this.type = _type;
		this.model = model;
		this.tsserver = tsserver
		this.update = (...args) => update(...args);

		this.parent = parent;
		this.cursor = sig(cursor || -1);
	}

	get blocks() {
		return this.model.blocks;
	}

	update_blocks(...args) {
		return this.update("blocks", ...args);
	}

	len() {
		return this.model.blocks.length;
	}

	next() {
		this.len() > this.cursor() + 1
			? this.cursor.set(this.cursor() + 1)
			: this.cursor.set(0);
	}

	prev() {
		this.cursor() > 0
			? this.cursor.set(this.cursor() - 1)
			: this.cursor.set(this.len() - 1);
	}

	write() {
		const queue = this.model.blocks.map((comp) => comp.write);
		let start = 0
		const run = (code, index) => {
			if ("function" == typeof code) {
				this.update_blocks(index, produce((el) => {
					el.start = start
					code(el)
					start += el.output.length
				}))
			}
		}

		batch(() => {
			queue.forEach(run)
		});

		this.output = this.model.blocks.map((e) => e.output).join("");
	}

	async lint(from, to) {
		if (!this.tsserver) { return this.parent.lint(from + this.start, to + this.start) }

		let sem_diagnostics = await this.tsserver.semantic_diagnostics();
		let syn_diagnostics = await this.tsserver.syntactic_diagnostics();

		if (!Array.isArray(sem_diagnostics)) sem_diagnostics = []
		if (!Array.isArray(syn_diagnostics)) syn_diagnostics = []
		const diagnostics = [...sem_diagnostics, ...syn_diagnostics]
		if (!diagnostics) return []

		return diagnostics
			.filter(d => d.start !== undefined && d.length !== undefined)
			.map(d => {
				if (d.code == 7006 || d.code == 7005) return
				let severity = "error"

				let f = d.start - from // if from < f, => f < 0 
				let t = f + d.length

				if (f < 0) { return }
				if (d.start + d.length >= to) { return }

				let message = d.messageText

				return {
					from: f,
					to: t,
					severity,
					message
				};
			}).filter((e) => e != undefined);
	};

	async completion(pos, ctx) {
		if (!ctx) return null
		if (!this.tsserver) {
			// then send req to parent and add personal start
			const c = this.parent.completion(pos + this.start, ctx)
			return c
		}

		const completions = await this.tsserver.completion_at(pos);
		if (!completions) { return null; }

		let completList = completeFromList(
			completions.entries.map((c, _) => {
				return {
					type: c.kind,
					label: c.name,
					boost: 1 / parseInt(c.sortText),
				}
			})
		)(ctx)

		return completList
	}

	// TODO: Localstorage and reload?
	load(path) {
		fetch("/fs/" + path).then((res) => res.json())
			.then((res) => {
				res.blocks
					? this.update("blocks", res.blocks)
					: console.log("no blocks");
				CURRENT_PATH.set(path);
			});
	}

	// TODO: Implement saving functions in the editor itself -> next version
	// TODO: Make a component for file directory editing and saving stuff
	overwrite(path) {
		console.log("overwriting", path);

		const body = {
			content: JSON.stringify(this.model, null, 2),
		};

		fetch("/fs/" + path, {
			headers: { "Content-Type": "application/json" },
			method: "PUT",
			body: JSON.stringify(body),
		});
	}

	create_new(path) {
		const body = {
			content: JSON.stringify(this.model, null, 2),
		};
		fetch("/fs/" + path, {
			headers: { "Content-Type": "application/json" },
			method: "POST",
			body: JSON.stringify(body),
		});
	}

	save(path) {
		fetch("/exists/" + path).then((res) => res.json()).then((res) =>
			res.exists ? this.overwrite(path) : this.create_new(path)
		);
	}

	preview(path) {
		// fix this
		this.output_file(path).then((res) => {
			window.location = "/fs/" + path;
		});
	}

	output_file(path) {
		const body = {
			content: iframe(),
		};

		fetch("/fs/" + path, {
			headers: { "Content-Type": "application/json" },
			method: "PUT",
			body: JSON.stringify(body),
		});
	}
}

class Tsserver {
	constructor(file = "", browser = false) {
		this.env = null
		this.file = file
		this.browser = browser

		if (this.browser) {
			//TODO: Turn into webworker later
			createEnvironment("console.log('hello world')").then((e) => {
				this.env = e;
				// add tsconfig.json
				this.update_file(this.file)
			})
		}
	}

	update_file(content) {
		if (!content || content.length == 0) return
		let space_only = true
		content.split("").forEach((c) => { if (c != " ") space_only = false })
		if (space_only) return

		if (this.browser) {
			if (this.env) { this.env.updateFile("index.js", content) }
			else this.file = content
		}

		fetch("/tsserver/update", {
			method: "POST", body: JSON.stringify({ content }),
			headers: { "Content-Type": "application/json" }
		})

	}

	async completion_at(pos) {
		if (this.browser) {
			if (this.env) return this.env.languageService.getCompletionsAtPosition('index.js', pos)
			else return []
		}

		try {
			const res =
				await fetch("/tsserver/completion_at", {
					headers: { "Content-Type": "application/json" },
					method: "POST", body: JSON.stringify({ pos })
				})
			let ret = await res.json()
			return ret
		} catch (err) {
			return null
		}
	}

	async semantic_diagnostics() {
		if (this.browser) {
			if (this.env) return this.env.languageService.getSemanticDiagnostics('index.js')
			else return []
		}

		try {
			const res = await fetch("/tsserver/semantic_diagnostics")
			let ret = await res.json()
			return ret.content
		} catch (err) {
			return []
		}
		// if (this.env) return this.env.languageService.getSemanticDiagnostics('index.js')
		// else return []
	}

	async syntactic_diagnostics() {
		if (this.browser) {
			if (this.env) return this.env.languageService.getSyntacticDiagnostics('index.js')
			else return []
		}

		try {
			const res = await fetch("/tsserver/syntactic_diagnostics")
			let ret = await res.json()
			return ret.content

		} catch (err) {
			return []
		}
	}


}

//TODO: make this part of the editor...
class Positioner {
	constructor(x, y, w, h, unit = "v", position = "fixed") {
		this.x = sig(x || 0);
		this.y = sig(y || 0);
		this.w = sig(w || 0);
		this.h = sig(h || 0);

		this.unit = unit;
		this.position = position;

		this.style = mem(() => {
			const v = this.unit == "v" ? "vh" : this.unit;
			const h = this.unit == "v" ? "vw" : this.unit;

			return `
				position: ${this.position};
				top: ${this.y() + v};
				left: ${this.x() + h};
				height: ${this.h() + v};
				width: ${this.w() + h};
			`;
		});
	}

	get css() {
		return this.style;
	}
}

// Pass Editor into M -> so the live code in editor can change stuff in this editor.
class Editor {
	/**
	 * @param {Object} EditorOpts 
	 * @param {State} EditorOpts.state 
	 * */
	constructor({ state, components, renderer }) {
		if (!renderer) throw Error("Need a renderer");
		this.tsserver = new Tsserver()
		if (state) state.tsserver = this.tsserver
		this.state = state ? state : new State({ type: "RootGroup", tsserver: this.tsserver });

		this.renderer = renderer;
		this.renderers = components ? components : new RendererList();
		this.positioner = new Positioner(0, 0, 50, 100);

		this.live_output = sig(null)
		this.output = mem(() => this.state.model.blocks.map((b) => b.output || "").join("") || "")


		eff_on(this.output, () => { this.tsserver.update_file(this.output()) })

		eff_on(this.live_output, () => {
			if (this.live_output() && this.live_output() != null) {
				let out = this.live_output()
				this.tsserver.update_file(out)
			}
		})
	}

	register(type, fn_str) {
		this.renderers.register(type, fn_str);
	}

	get css() {
		return this.positioner.css
	}

	bind(element, setter) {
		const render = this.renderer;
		const component = render(element, this.state);

		setter((el) => {
			Object
				.entries(component)
				.forEach(([key, value]) => el[key] = value);
		});

		return component.render;
	}

	render() {
		const setter = (fn) => this.state.update(produce(fn));
		return this.bind(this.state, setter);
	}
}

//TODO: make these available at user runtime
function state_utils(state) {
	const find_focused = () => state.blocks.find((e) => e.focus);
	const set_current_active = () => {
		if (!state.blocks[state.cursor()]) return;
		state.update_blocks(state.cursor(), "active", true);
		state.update_blocks((_, i) => i != state.cursor(), "active", false);
	};

	const set_current_focus = () => {
		if (!state.blocks[state.cursor()]) return;
		const current = state.blocks[state.cursor()];
		state.update_blocks(state.cursor(), "focus", true);
		if (current.onfocus) current.onfocus();
	};

	const unfocus_current = () => {
		const current = find_focused(state);
		if (!current) return;
		if (current.handle_unfocus) current.handle_unfocus()
		else {
			state.update_blocks((e) => e.focus, "focus", false);
			if (current.onunfocus) current.onunfocus();
		}
	};
	return {
		find_focused,
		set_current_active,
		set_current_focus,
		unfocus_current,
	};
}

const child_style = (child) => {
	const border_is = mem(() => child.active && !child.focus);
	const shadow_is = mem(() => child.focus);

	const border = mem(() => border_is() ? "border: .5px solid red" : "");
	const box_shadow = mem(() =>
		shadow_is() ? "box-shadow: 0 0 25px 15px rgba(0,0,0,.1)" : ""
	);

	return mem(() => [border(), box_shadow()].join(";"));
};

const add_widget = (opts, state) => {
	if (!opts.id) opts.id = uid()
	state.update_blocks(produce((e) => e.push(opts)));

	editor.state.write()
}

// =============
// Root Renderer
// =============
/**
 * @param {State} state
 */
function RootRenderer(el, state) {
	if (!state) throw Error("NEED STATE")

	const blocks = el.blocks || [];
	state = state || new State({ blocks });



	// add these to state as prototype?
	const {
		set_current_focus,
		set_current_active,
		find_focused,
		unfocus_current,
	} = state_utils(state);

	eff_on(state.cursor, set_current_active);


	const bind = (child, index) => {
		if (!child) return;
		const item = editor.renderers.find(child.type);
		if (!(typeof item == "function")) return;

		const setter = (...args) => state.update_blocks(index(), ...args);
		const controller = { set_self: setter, state: state };
		const component = item(child, index, controller);

		setter(produce((block) => {
			Object
				.entries(component)
				.forEach(([key, value]) => block[key] = value);
		}));

		const style = child_style(child);
		return h("div", { style: style }, component.render);
	};

	const keys = new Keymanager();

	keys.on("Escape", unfocus_current);
	keys.on("Enter", set_current_focus);
	keys.on("shift+c", (_) => add_widget({ type: "code" }, state));
	keys.on("shift+a", (_) => add_widget({ type: "basic" }, state));
	keys.on("shift+g", (_) => add_widget({ type: "group" }, state));
	keys.on("shift+;", () => {
		input_ref.value = ":";
		input_ref.focus();
	});
	// keys.on("cmd+m", (_) => state.save(save_path));
	// keys.on("cmd+l", (_) => state.load(save_path));
	// keys.on("cmd+o", (_) => state.output_file("output.html"));
	keys.on("cmd+e", (_) => state.preview("output.html"));
	// keys.on("cmd+b", (_) => console.log("source", CURRENT_PATH));
	keys.on("ctrl+s", (_) => state.write());
	keys.on("j", (_) => state.next());
	keys.on("k", (_) => state.prev());
	const handle_keys = (e) => {
		const focused = find_focused();

		if (focused && e.key != "Escape") {
			if (focused.onkeydown) focused.onkeydown(e);
			return;
		}

		keys.event(e);
	};

	const write = (el) => {
		state.write();
		let output = state.blocks.map((child) => child.output).join("\n");
		el.output = output;
		el.blocks = state.blocks;
	};


	// ---------------
	// Input Bar
	// ---------------
	const style = `
		all: unset;
		border: .5px #eee solid;
	`;

	const on_input = (e) => console.log(e.target.value);
	const on_keydown = (e) =>
		e.key == "Escape" ? (input_ref.blur(), input_ref.value = "") : null;

	let input_ref = (e) => input_ref = e;
	const input_bar = h("input", {
		ref: input_ref,
		type: "text",
		style: style,
		oninput: on_input,
		onkeydown: on_keydown,
	});

	return {
		render: () =>
			h("div.group", () => each(() => state.blocks, bind), input_bar),
		onkeydown: handle_keys,
		write: (el) => write(el),
	};
}

let s = {
	blocks: [{
		type: "code",
		output:
			`import {mut} from "/lib/solid/monke.js"
	const M = mut({});
	document.M = M;
	const defer = (fn, t = 200) => setTimeout(fn, t)

	defer(function() {
		let E = M.EDITOR
		if (!E) return
		// E.state.load("utils/fileviewer.json")
	})
`}]
}

const state = new State(s)

const editor = new Editor({ renderer: RootRenderer, state });

/**
 * @typedef {Object} View
 *
 * @property {(el) => void} write
 * @property {() => any[] | any} render
 *
 * @property {() => void} [onkeydown]
 * @property {() => void} [onfocus]
 * @property {() => void} [onunfocus]
 */
window.onload = () => {
	window.addEventListener("keydown", (e) => {
		if (editor.state.model.onkeydown) {
			editor.state.model.onkeydown(e);
		}
	});
};

// Document as known issues
const f = "/";
const iframe = mem(() =>
	`<script type="module"> 
			const SOURCE_PATH = "${CURRENT_PATH()}"
			${editor.state.blocks.map((e) => e.output).join("\n")}
		<${f}script>
`
);

eff_on(iframe, () => defer(function() {
	console.log("Hey iframe was changed")
	if (m()) m().EDITOR = editor
}, 1500))

const Root = () => {
	const iframe_pos = new Positioner(50, 0, 50, 100);

	const iframe_style = iframe_pos.css;
	const editor_style = mem(() => "overflow-y: scroll;" + editor.css());

	return h("div", [
		h("div.editor", { style: editor_style }, editor.render()),
		h("iframe.iframe", { ref: iframe_ref.set, srcdoc: iframe, style: iframe_style }),
	]);
};

// ------------------------
// BASIC ELEMENT
// ------------------------
const basic = (el) => {
	const name = el.name || "unnamed";
	return ({ render: () => h("p", "basic ", name) });
};
editor.register("basic", basic.toString());

// ------------------------
// CODEMIRROR ELEMENT
// ------------------------
function code_element(state, index, control) {
	const code = mem(() => state?.output ? state?.output : "");

	// only used for syncing with tsserver
	const live_code = sig()
	const id = uid();
	let save, focus;

	Vim.defineEx("write", "w", () => editor.state.write());

	const live_output = mem(() => {
		if (state.focus) {
			let code_map = {}
			code_map[state.id] = live_code()
			// console.log("codemap, state id", code_map[state.id])

			const get_state_code_and_map = (state, map) => {
				let id = state.id
				let code = state.blocks
					.map((block) => map[block.id]
						? map[block.id]
						: block.output
							? block.output
							: "")
					.join("")

				map[id] = code
				return code
			}

			let parent = control.state
			let full_code = ""

			// check if control.state
			while (parent) {
				// console.log('checknig', parent)
				full_code = get_state_code_and_map(parent, code_map)
				parent = parent.parent
			}

			return full_code
		}
		else return null
	})

	eff_on(live_output, () => {
		if (live_output()) editor.live_output.set(live_output())
		else editor.live_output.set(null)
	})

	// codemirro on change extension

	const render = () => {
		mounted(() => {
			let extensions = [
				linter(() => {
					let start = state.start ? state.start : 0
					let end = start + live_code().length

					// TODO: Change this to parent group state .lint -> and propogate start offset...
					return control.state.lint(start, end)
				}),

				autocompletion({
					activateOnTyping: true,
					maxRenderedOptions: 20,
					override: [async (ctx) => {
						let { pos } = ctx
						let start = state.start ? state.start : 0
						let completion = await control.state.completion(pos + start, ctx)
						return completion
					}],
				}),


				EditorView.updateListener.of(throttle((e) => live_code.set(e.state.doc.toString() + "\n"), 100))]

			const cm_editor = make_code_mirror(code(), id, extensions);
			focus = () => setTimeout(() => cm_editor.focus(), 100);

			save = function(el) {
				// TODO: add "\n" only when not already added... 
				// TODO: Also mirro mechanism where else doc is accessed.
				const text = cm_editor.state.doc.toString() + "\n"
				console.log("text", text, "start", el.start);
				el.focused = cm_editor.hasFocus;
				el.output = text;
				el.cursor = cm_editor.state.selection.ranges[0].from;
			};

			defer(function() {
				if (state.cursor && state.focused) {
					const selection = { anchor: state.cursor, head: state.cursor };
					cm_editor.focus();
					cm_editor.dispatch({ selection });
				}
			});
		});

		return h("div", { class: "editor-" + id });
	};

	// TODO: COMPONENT: template object representation
	// should have icons for things and have intellisense...
	return ({
		render: render,
		onfocus: () => focus(),
		write: (...args) => save(...args),
	});
}
editor.register("code", code_element.toString());

// ------------------------
// GROUP Renderer
// ------------------------
/**
 * @typedef {Object} Controller
 * @property {State} state
 *
 */

/**
 * @param {Controller} c 
 */
function GroupRenderer(el, i, c,) {
	// new state
	let state = new State({ blocks: el.blocks || [], parent: c.state, id: el.id })

	// add these to state as prototype?
	const {
		set_current_focus,
		set_current_active,
		find_focused,
		unfocus_current,
	} = state_utils(state);

	eff_on(state.cursor, set_current_active);

	const _unfocus = () => {
		// if none in focus unfocus self, else just forward to unfocus current
		let focused = find_focused()
		if (!focused) c.set_self("focus", false)
		else unfocus_current()
	}


	const bind = (child, index) => {
		if (!child) return;
		const item = editor.renderers.find(child.type);
		if (!(typeof item == "function")) return;

		const setter = (...args) => state.update_blocks(index(), ...args);
		const controller = { set_self: setter, state: state };
		const component = item(child, index, controller);

		setter(produce((block) => {
			Object
				.entries(component)
				.forEach(([key, value]) => block[key] = value);
		}));

		const style = child_style(child);
		return h("div", { style: style }, component.render);
	};

	const keys = new Keymanager();

	keys.on("Enter", set_current_focus);
	keys.on("shift+c", (_) => add_widget({ type: "code" }, state));
	keys.on("shift+g", (_) => add_widget({ type: "group" }, state));
	keys.on("shift+a", (_) => add_widget({ type: "basic" }, state));
	keys.on("j", (_) => state.next());
	keys.on("k", (_) => state.prev());
	keys.on("ctrl+s", (_) => state.write());

	const handle_keys = (e) => {
		const focused = find_focused();

		if (focused && e.key != "Escape") {
			if (focused.onkeydown) focused.onkeydown(e);
			return;
		}

		keys.event(e);
	};

	const write = (el) => {
		state.write();
		let output = state.blocks.map((child) => child.output).join("");
		console.log('Group starts at: ', el.start)
		//TODO : FUCKING FIX THIS
		state.start = el.start
		el.output = output;
		el.blocks = state.blocks;
	};


	return {
		render: () =>
			h("div.group", () => each(() => state.blocks, bind)),
		onkeydown: handle_keys,
		write: (el) => write(el),
		handle_unfocus: _unfocus,
	};
}

editor.register("group", GroupRenderer.toString())

//
// ------------------------
// CODEMIRROR UTILS
// ------------------------
function make_code_mirror(source, id, extensions) {
	const element = document.querySelector(".editor-" + id);
	const state = {
		doc: source,
		extensions: [
			vim(),
			basicSetup,
			javascript(),
			// theme,
			...extensions,

			keymap.of([
				{
					key: "Escape",
					run: () => {
						editor.contentDOM.blur();
						window.getSelection()?.removeAllRanges();
					},
				},
			]),
		],
	};

	const editor = new EditorView({
		parent: element,
		state: EditorState.create(state),
	});

	return editor;
}


const createTheme = ({ variant, settings, styles }) => {
	const theme = EditorView.theme(
		{
			// eslint-disable-next-line @typescript-eslint/naming-convention
			"&": {
				backgroundColor: settings.background,
				color: settings.foreground,
			},
			".cm-editor.cm-focused": {
				outline: "none",
			},
			".cm-content": {
				caretColor: settings.caret,
			},
			".cm-cursor, .cm-dropCursor": {
				borderLeft: "2px solid" + settings.caret,
			},
			"&.cm-focused .cm-selectionBackgroundm .cm-selectionBackground, .cm-content ::selection":
			{
				backgroundColor: settings.selection,
			},
			".cm-activeLine": {
				backgroundColor: settings.lineHighlight,
			},
			".cm-gutters": {
				backgroundColor: settings.gutterBackground,
				color: settings.gutterForeground,
			},
			".cm-activeLineGutter": {
				backgroundColor: settings.lineHighlight,
			},
		},
		{
			dark: variant === "dark",
		},
	);

	const highlightStyle = HighlightStyle.define(styles);
	const extension = [theme, syntaxHighlighting(highlightStyle)];

	return extension;
};

const theme = createTheme({
	variant: "light",
	settings: {
		background: "black",
		foreground: "white",
		caret: "red",
		selection: "#036dd626",
		gutterBackground: "#fcfcfc22",
		gutterForeground: "#8a919922",
		lineHighlight: "#8a919922",
	},
	styles: [
		{
			tag: t.comment,
			color: "#666",
		},
		{
			tag: t.string,
			color: "#00ffee",
		},
		{
			tag: t.regexp,
			color: "#4cbf99",
		},
		{
			tag: [t.number, t.bool, t.null],
			color: "blue",
		},
		{
			tag: t.variableName,
			color: "beige",
		},
		{
			tag: [t.definitionKeyword, t.modifier],
			color: "#EEED95",
		},
		{
			tag: [t.keyword, t.special(t.brace)],
			color: "#EEED95",
		},
		{
			tag: t.operator,
			color: "#F66BAC",
		},
		{
			tag: t.separator,
			color: "#5c6166b3",
		},
		{
			tag: t.punctuation,
			color: "#EEED95",
			boxShadow: "0 0 2px 1px #EEED9566",
		},
		{
			tag: [t.definition(t.propertyName), t.function(t.variableName)],
			color: "yellow",
			padding: "2px",
			border: "1px yellow dotted",
			borderRadius: "8px",
		},
		{
			tag: [t.className, t.definition(t.typeName)],
			color: "#F66BAC",
		},
		{
			tag: [t.tagName, t.typeName, t.self, t.labelName],
			color: "#55b4d4",
		},
		{
			tag: t.angleBracket,
			color: "#55b4d480",
		},
		{
			tag: t.attributeName,
			color: "#F66BAC",
		},
	],
});

render(Root, document.body);

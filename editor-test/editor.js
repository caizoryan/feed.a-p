import { mut } from "/lib/solid/monke.js"

const M = mut({});
document.M = M;
const defer = (fn, t = 200) => setTimeout(fn, t)

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

import { MD } from "/lib/md.js"

import { Keymanager } from "/lib/keymanager.js";
import { drag } from "/lib/drag.js"
import { createPanZoom } from "/lib/panzoom/panzoom.js"

// -------------
// Codemirror Imports
// -------------
import * as cm from "/lib/codemirror/codemirror.js"
const { basicSetup, EditorView, Vim, vim } = cm
const { indentWithTab } = cm.commands
const { EditorState, StateField } = cm.state
const { keymap, showTooltip } = cm.view
const { toggleFold, foldAll, HighlightStyle, syntaxHighlighting, } = cm.language
const { javascript } = cm.lang_javascript
const { css } = cm.lang_css
const { tags } = cm.lezer_higlight
const { lintGutter, linter, openLintPanel } = cm.lint
const { autocompletion, completeFromList } = cm.autocomplete
let t = tags


// -------------
// UTILITIES
// -------------

const curtain = sig(true)
const GROUPBG = mem(() => curtain() ? "#ffbb0088" : "#ffffff22")
const BACKGROUND = "#eeea"
const FOREGROUND = "grey"


// -------------
// UTILITIES
// -------------

async function post(url = "", body) {
	try {
		let f = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body)
		}).then((res) => res.json())
		return f
	} catch {
		return null
	}
}

let CURRENT_PATH = sig("");
const m = () => { return iframe_ref()?.contentDocument.M }

// -------------
let iframe_ref = sig(null)

eff_on(iframe_ref, () => {
	if (iframe_ref()) { if (m()) m().EDITOR = editor }
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
	 * @param {name} string
	 * @returns {() => View}
	 */
	find(type) {
		const fn_str = this.renderers[type];
		const fn = eval_code(fn_str);
		if (typeof fn == "function") return fn;
		else throw new Error("invalid renderer");
	}
}

class State {
	constructor({ type, blocks, parent, cursor, id, tsserver, properties }) {
		const _blocks = blocks ? blocks : [];
		const _properties = properties ? properties : {};
		const _type = type ? type : "default";
		const _id = id ? id : uid();

		const [model, update] = store({
			blocks: _blocks,
			output: "",
			properties: _properties
		});

		this.id = _id;
		this.type = _type;
		this.model = model;
		this.tsserver = tsserver
		this.update = (...args) => update(...args);

		/** @type {Array<Function>}*/
		this.write_fn = []
		this.start = 0

		this.parent = parent;
		this.cursor = sig(cursor || -1);
	}

	get blocks() {
		return this.model.blocks;
	}

	update_blocks(...args) {
		return this.update("blocks", ...args);
	}

	update_properties(...args) {
		return this.update("properties", ...args);
	}

	register_write(fn) {
		this.write_fn.push(fn)
	}

	len() {
		return this.model.blocks.length;
	}

	next() {
		this.len() > this.cursor() + 1
			? this.cursor.set(this.cursor() + 1)
			: null;
		// : this.cursor.set(0);
	}

	prev() {
		this.cursor() > 0
			? this.cursor.set(this.cursor() - 1)
			: null
		// : this.cursor.set(this.len() - 1);
	}

	write() {
		const queue = this.model.blocks.map((comp) => comp.write);
		let start = 0
		const run_fn = fn => (code, index) => {
			if ("function" == typeof code) {
				fn(index, produce((el) => {
					el.start = start
					code(el)
					start += el.output.length
				}))
			}
		}

		const run_fnn = (code) => {
			if ("function" == typeof code) {
				this.update_properties(produce((el) => {
					console.log("running?")
					code(el)
				}))
			}
		}

		batch(() => {
			queue.forEach(run_fn(this.update_blocks.bind(this)))
			this.write_fn.forEach(run_fnn)
		});

		this.output = this.model.blocks.map((e) => e.output).join("");
	}

	//***************************
	// --------------------------
	// Put these in a utility fn?
	// --------------------------
	//***************************
	focus_on_pos(pos) {
		let that = this


		let start = that.start
		let found = false
		let f_i = null

		that.blocks.forEach((block, i) => {
			if (found) return

			// check 
			if (block.output.length + start > pos) {
				f_i = i
				found = true
				return
			}

			else start += block.output.length
		})

		if (found) {
			// pos is contained in this block, pass focus_on_pos to block
			that.update_blocks(produce(blocks => {

				// unfocus all blocks and focus this one
				blocks.forEach((block, ii) => {

					// not these blocks
					if (f_i !== ii) {
						if (block.focus) { if (block.onunfocus) block.onunfocus() }
						block.focus = false
						block.active = false
					}

					// this is the block
					else {
						that.cursor.set(f_i)
						block.focus = true
						// TODO: Changed this hopefully works still
						// if this doesn't work put it back in below if block.
						found = true

						// ---------------------
						// handles focusing
						// ---------------------
						if (typeof block.focus_on_pos == "function") {
							block.focus_on_pos(pos - that.start)
						}
						else if (block.onfocus) {
							block.onfocus()
						}

					}

				})
			}))

		}

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

	async find_definition(pos) {
		if (!this.tsserver) {
			// then send req to parent and add personal start
			const c = this.parent.find_definition(pos + this.start)
			return c
		}

		const quick = await this.tsserver.find_definition(pos);
		if (!quick) { return null; }
		return quick
	}

	async quick_info(pos) {
		if (!this.tsserver) {
			// then send req to parent and add personal start
			const c = this.parent.quick_info(pos + this.start)
			return c
		}

		const quick = await this.tsserver.quick_info(pos);
		if (!quick) { return null; }
		return quick
	}

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
		console.log("lOADDEd")
		console.log("fetching", path)
		fetch(path).then((res) => res.json())
			.then((res) => {
				if (res.blocks) {
					this.update("blocks", res.blocks)
				}
				else {
					console.log("no blocks");
				}
				CURRENT_PATH.set(path);
			});
	}

	// TODO: Implement saving functions in the editor itself -> next version
	// TODO: Make a component for file directory editing and saving stuff
	overwrite(path) {
		console.log("overwriting", path);
		console.log("props", this.model.properties);

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

	async find_references(pos) {
		return post("/ts/findReferences", { args: [pos] })
			.then((res) => {
				if (!res) return
				return res
				if (res[0].definition && res[0].definition.fileName == "index.js") return (res[0].definition.textSpan.start)
				else return null
			})
	}

	async find_definition(pos) {
		let res = await this.find_references(pos)
		if (!res) return null
		if (res[0].definition && res[0].definition.fileName == "index.js") return res[0].definition.textSpan.start
		else return null

	}

	async quick_info(pos) {
		return await post("/ts/getQuickInfoAtPosition", { args: [pos] }).then(async (res) => {
			if (!res) return
			if (res && res.displayParts) {
				let result = await post("/ts/displayPartsToString", { args: [res.displayParts] })
				let description = ""
				res.documentation?.length
					? description += await post("/ts/displayPartsToString", { args: [res.documentation] })
					: null
				return result
			}
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
		/** @type {State}*/
		this.state = state ? state : new State({ type: "RootGroup", tsserver: this.tsserver });

		this.iframe_pos = new Positioner(0, 0, 100, 100);
		this.renderer = renderer;
		this.renderers = components ? components : new RendererList();

		this.root_element = undefined

		this.positioner = new Positioner(0, 0, 100, 100);
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

	toggle_hide() {
		if (this.positioner.x() > 0) this.positioner.x.set(0)
		else { this.positioner.x.set(85) }
	}

	get css() {
		return this.positioner.css
	}

	write() {
		if (this.root_element && "function" == typeof this.root_element?.write) {

		}
	}

	bind(element, setter) {
		const render = this.renderer;
		const component = render(element, this.state);

		setter((el) => {
			Object
				.entries(component)
				.forEach(([key, value]) => {
					if (key == "write") {
						state.register_write(value)
					}

					el[key] = value
				});
		});

		this.root_element = component
		return component.render;
	}

	// TODO: Broadcast a message, 
	// message can be an object, fn whatever
	// might adopt a facet type architecture.
	// editor_theme_facet = Facet.define()
	// editor_theme_facet.of({value})

	// broadcast(editor_theme_facet.message({value}))
	broadcast(message) {
		// inside:
		// for each of blocks -> block.message(message)
	}

	show(element) {
		let found = this.state.blocks.find((el) => el.id == element.id)
		if (found &&
			found.top &&
			found.left &&
			found.width &&
			found.height
		) {
			let x = found.left()
			let y = found.top()
			let w = found.width()
			let h = found.height()
			this.root_element.show(x, y, w, h)
		}
	}

	render() {
		const setter = (fn) => this.state.update(produce(fn));
		return this.bind(this.state, setter);
	}
}

//TODO: make these available at user runtime
function state_utils(state) {
	const find_focused = () => state.blocks.find((e) => e.focus);
	const find_active = () => state.blocks.find((e) => e.active);

	function move_child(index, direction) {
		let changed = false
		state.update_blocks(
			produce((el) => {
				if (!el[index + direction] || !el[index]) return;
				let temp = el[index];
				el[index] = el[index + direction];
				el[index + direction] = temp;
				changed = true
			}),
		);

		if (changed) state.cursor.set(state.cursor() + direction)
	};


	function is_scrollable(el) {
		return el.scrollHeight > el.clientHeight;
	}


	function find_offset_to_parent(el, parent) {
		return [el.offsetLeft - parent.offsetLeft, el.offsetTop - parent.offsetTop];
	}

	function get_scrollabe_parent(el) {
		let found_parent = false;
		let element = el;

		do {
			element = element.parentElement;

			if (!element) return;
			if (is_scrollable(element)) found_parent = true;
		} while (!found_parent && element);

		return element;
	}


	const scroll_to_active = () => {
		let active = find_active()
		if (!active) return
		let id = "block-" + active.id

		let el = document.getElementById(id);
		let parent = get_scrollabe_parent(el);
		if (parent) {
			let [x, y] = find_offset_to_parent(el, parent);
			parent.scrollTo({ top: y - 50 });
		}
	}


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
		find_active,
		scroll_to_active,
		set_current_active,
		set_current_focus,
		unfocus_current,
		move_child,
	};
}

const child_style = (child, pos) => {
	const active_is = mem(() => child.active && !child.focus);
	const shadow_is = mem(() => child.focus);

	const active = mem(() => active_is()
		? `
    padding: 1em;
    box-shadow: 0 0 50px 15px rgba(0,0,0,.1);
    `
		: "filter: grayscale(1);");

	const box_shadow = mem(() =>
		shadow_is() ? `
      padding: 1em;
      box-shadow: 0 0 25px 5px rgba(127,0,255,.1);
      filter:none;
      opacity:1;
      ` : ""
	);

	const coordinates = mem(() => {
		if (!child.top
			|| !child.left
			|| !child.height
			|| !child.width
		) return ""
		return `
        top: ${child.top()}px;
        left: ${child.left()}px;
        width: ${child.width()}px;
        height: ${child.height()}px;
  `})

	const additional = mem(() => `
        background: #ffffff11; 
        border: 1px solid #22222244;
        position: absolute;
        padding: 3px;
        padding-top: 25px;
        ${coordinates()}
  `)


	return mem(() => [additional(), active(), box_shadow()].join(";"));
};

//TODO: add at current cursor
const add_block = (opts, state) => {
	if (state.cursor() < -1 || state.cursor() >= state.blocks.length) return
	if (!opts.id) opts.id = uid()

	editor.state.write()

	state.update_blocks(produce((e) =>
		e.splice(state.cursor() + 1, 0, opts)));

}

let url_ = window.location
let to_load = "/feed.json"
if (url_.toString().includes("about:srcdoc")) {
	console.log("src doc location", url_)
}

else {
	console.log("chillin at the club", url_)
	let path = url_.search.substring(1)

	// TODO: If path exists ask server
	console.log(path)

	if (path) to_load = path
}

const state = new State({})
state.load(to_load)


const editor = new Editor({ renderer: View, state });

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
    <${f}script>`
);

// TODO: Make it so this is polled
eff_on(iframe, () => defer(function() {
	if (m()) m().EDITOR = editor
}, 500))

const Root = () => {
	const iframe_style = editor.iframe_pos.css;
	const editor_style = mem(() => `
      background-size: 20px 20px;
      ${curtain() ?
			`background-image:
		linear-gradient(to right, #0002 1px, transparent 1px),
		linear-gradient(to bottom, #0002 1px, transparent 1px);
       background-color: #fff9;
        `
			: ""
		}
      overflow: hidden;
      ` + editor.css());

	return h("div", [
		h("style", global_style),
		h("iframe.iframe", { ref: iframe_ref.set, srcdoc: iframe, style: iframe_style }),
		h("div.editor", { style: editor_style }, editor.render()),
	]);
};

let global_style = mem(() => `
  html {
    font-size: 14.5px;
  }
  
  ::-webkit-scrollbar {display: none;}
  
  @font-face {
    font-family: 'DiatypeMono';
    src: url('/fs/fonts/diatype_mono.ttf') format('truetype');
    }
  
  * {
    padding: 0;
    margin: 0;
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
    font-family: "DiatypeMono";
  }

  .child {
    overflow-y: scroll;
  }

  input[type="text"] {
    all: unset;
    border: 1px ${FOREGROUND} solid;
    background: ${BACKGROUND};
  }
  
  button {
    all: unset;
    cursor: pointer;
    padding: 2px;
    font-size: .8em;
    color: ${FOREGROUND};
    background: ${BACKGROUND};
    border: 1px ${FOREGROUND} solid;
    margin: 0 .5em ;
  }
  
  iframe {
    all: unset;
  }
  
  body {
    background:${BACKGROUND};
    color: ${FOREGROUND};
  }
  
  .group {
    position: absolute;
    top: 0;
    left: 0;
    background: ${GROUPBG()};
    width: 500vw;
    height: 500vh;
  }

  textarea {
    all: unset;
    background: ${BACKGROUND};
    color: ${FOREGROUND};
  }
  
  .md {
    padding: 1em;
    background-color: ${BACKGROUND};
    color: ${FOREGROUND};
  }
`)






















// ----------------------------
// What other variables to have
// Where should this be stored?
// store it in editor? root state?
// maybe root state and can be passed by the editor
// ----------------------------
// ----------------------------
// if load from state,
// at user level, can edit the state...
// and that can be the config. 
// and this way can also have config file...
// load for -> keymaps, menu items.
// In that case have to have a basic dsl (vim cmds type)
// For config. 
// ----------------------------

let traveling = sig(true)
let smooth = sig(true)
let buffer = mut([-1, -1, -1, -1, -1])
// ----------------------------

// =============
// Root Renderer
// =============
/**
 * @param {State} state
 */
function View(el, state) {
	if (!state) throw Error("NEED STATE")

	const blocks = el.blocks || [];
	const cursor = el.cursor || -1;

	setTimeout(() => {
		const _buffer = state?.model?.properties?.buffer
			? state.model.properties.buffer
			: [-1, -1, -1, -1, -1]

		_buffer.forEach((e, i) => buffer[i] = e)
	}, 100)

	state = state || new State({ blocks, cursor });


	// add these to state as prototype?
	const {
		set_current_focus,
		set_current_active,
		find_focused,
		find_active,
		unfocus_current,
		scroll_to_active,
		move_child
	} = state_utils(state);

	eff_on(state.cursor, () => {
		set_current_active()
		if (traveling()) {
			if (find_active()) editor.show(find_active())
		}
		// scroll_to_active()
	});
	// bring active in scroll


	const bind = (child, index) => {
		if (!child) return;
		const item = editor.renderers.find(child.type);
		if (!(typeof item == "function")) return;

		const setter = (...args) => state.update_blocks(index(), ...args);
		const controller = { set_self: setter, state: state };
		const component = item(child, index, controller);

		const cur_x = () => {
			let active = find_active()
			if (active && active.left) return active.left()
		}
		const cur_y = () => {
			let active = find_active()
			if (active && active.left) return active.top()
		}

		// TODO: For default position, check last child...
		let left = sig(child.drag_x ? child.drag_x : cur_x() + 300)
		let top = sig(child.drag_y ? child.drag_y : cur_y())


		// width is in px
		let width = sig(child.drag_w ? child.drag_w : 600)

		// height is in vh
		let height = sig(child.drag_h ? child.drag_h : 1200)


		let onref = (e) => {
			setTimeout(() => drag(e, { set_left: left.set, set_top: top.set }), 10)
		}

		setter(produce((block) => {
			block.left = left
			block.top = top

			block.width = width
			block.height = height

			Object
				.entries(component)
				.forEach(([key, value]) => {
					if (key == "write") {
						block[key] = (el) => {
							el.drag_x = left()
							el.drag_y = top()
							el.drag_w = width()
							el.drag_h = height()

							value(el)
						}
					} else {
						block[key] = value;
					}
				})
		}));

		const style = child_style(child);
		const click = () => {
			unfocus_current()
			state.cursor.set(index())
			set_current_focus()

			if (traveling()) {
				editor.show(child)
			}
		}

		let stats = () => h(
			"span.stats",
			() => `x: ${parseInt(left())}, y: ${parseInt(top())}`
		)

		// on active show x and y
		return h(
			"div.child",

			{
				ref: onref,
				style: style,
				onclick: click,
				id: "block-" + child.id
			},

			stats, component.render);
	};

	// TODO: Clean this up.. maybe make generic fn?
	// UpdateCoordinates(x: (add | set), y, w, h)

	// increase cur left
	// increase cur top
	const inc_cur_left = () => {
		let current = find_active()
		if (!current) return
		current.left ? current.left.set(current.left() + 10) : null
	}

	const dec_cur_left = () => {
		let current = find_active()
		if (!current) return
		current.left ? current.left.set(current.left() - 10) : null
	}

	const inc_cur_top = () => {
		let current = find_active()
		if (!current) return
		current.top ? current.top.set(current.top() + 10) : null
	}

	const dec_cur_top = () => {
		let current = find_active()
		if (!current) return
		current.top ? current.top.set(current.top() - 10) : null
	}

	const dec_cur_width = () => {
		let current = find_active()
		if (!current) return
		current.width ? current.width.set(current.width() - 10) : null
	}

	const inc_cur_width = () => {
		let current = find_active()
		if (!current) return
		current.width ? current.width.set(current.width() + 10) : null
	}

	const dec_cur_height = () => {
		let current = find_active()
		if (!current) return
		current.height ? current.height.set(current.height() - 10) : null
	}

	const inc_cur_height = () => {
		let current = find_active()
		if (!current) return
		current.height ? current.height.set(current.height() + 10) : null
	}

	const keys = new Keymanager();


	// -----------------
	// BASIC
	// -----------------
	keys.on("Escape", unfocus_current);
	keys.on("Enter", set_current_focus);

	// -----------------
	// Add Widgets
	// -----------------
	keys.on("shift+c", (_) => add_block({ type: "code" }, state));
	keys.on("shift+s", (_) => add_block({ type: "save-component" }, state));
	keys.on("shift+p", (_) => add_block({ type: "sandbox" }, state));
	keys.on("shift+m", (_) => add_block({ type: "md" }, state));
	keys.on("cmd+shift+l", (_) => add_block({ type: "load-component" }, state));
	keys.on("shift+g", (_) => add_block({ type: "group" }, state));

	// -----------------
	// navigate
	// -----------------
	keys.on("j", (_) => state.next());
	keys.on("k", (_) => state.prev());

	// -----------------
	// buffers
	// -----------------
	const buff_press = (index) =>
		(buffer[index - 1] != -1 && buffer[index - 1] != undefined)
			? editor.state.cursor.set(buffer[index - 1])
			: buffer[index - 1] = editor.state.cursor()


	keys.on("1", (_) => buff_press(1));
	keys.on("2", (_) => buff_press(2));
	keys.on("3", (_) => buff_press(3));
	keys.on("4", (_) => buff_press(4));
	keys.on("5", (_) => buff_press(5));


	// -----------------
	// dimensions
	// -----------------
	keys.on("shift+h", (_) => dec_cur_left())
	keys.on("shift+j", (_) => inc_cur_top())
	keys.on("shift+k", (_) => dec_cur_top())
	keys.on("shift+l", (_) => inc_cur_left())
	keys.on("shift+ArrowRight", (_) => inc_cur_width())
	keys.on("shift+ArrowLeft", (_) => dec_cur_width())
	keys.on("shift+ArrowDown", (_) => inc_cur_height())
	keys.on("shift+ArrowUp", (_) => dec_cur_height())

	// -----------------
	// move children
	// -----------------
	keys.on("alt+shift+ArrowUp", (_) => move_child(state.cursor(), -1))
	keys.on("alt+shift+ArrowDown", (_) => move_child(state.cursor(), 1))

	// -----------------
	// hide editor
	// -----------------
	keys.on("cmd+e", () => editor.toggle_hide())

	// -----------------
	// save
	// -----------------
	keys.on("ctrl+s", (_) => state.write());
	keys.on("cmd+s", (_) => state.write());

	let panzoom
	let parent_ref = (e) => {
		setTimeout(() => {
			// check if initialX, y, zoom are there

			let t = { ...state.model.properties.panzoom }
			console.log("t", t)
			panzoom = createPanZoom(e, {
				initialX: t.initialX ? t.initialX : 0,
				initialY: t.initialY ? t.initialY : 0,
				initialZoom: t.initialZoom ? t.initialZoom : 1,

				beforeWheel: function(e) {
					// allow wheel-zoom only if altKey is down. Otherwise - ignore
					const shouldIgnore = !e.altKey;
					return shouldIgnore;
				}


			})

		}, 100)
	}

	const handle_keys = (e) => {
		const focused = find_focused();

		if (focused && e.key != "Escape") {
			if (focused.onkeydown) focused.onkeydown(e);
			return;
		}
		keys.event(e);
	};

	const write = (el) => {
		console.log(el)
		let transform = panzoom.getTransform()
		let pan = {
			initialX: transform?.x,
			initialY: transform?.y,
			initialZoom: transform?.scale
		}

		console.log("saving", pan)

		el.panzoom = pan
		el.buffer = [...buffer]
		console.log("saving", el)
	};

	const Render = () => {
		let create_toggle_button = (title, signal) => {
			let style = mem(() => signal() ? ` opacity: 1 ` : ` opacity: .5 `)
			return h("button", {
				style: style,
				onclick: (e) => { signal.set(!signal()) }
			}, title)
		}

		let bar_style = `
      position: fixed;
      bottom: 1em;
      left: 1em;
      z-index: 999;
    `

		let travel = create_toggle_button("[autofocus]", traveling)
		let smoothie = create_toggle_button("[smooth]", smooth)
		let curtains = create_toggle_button("[curtain]", curtain)

		let buff_btn = (index, list) => {
			let text = mem(() => list[index] == -1 ? "x" : list[index])
			return h("button", { onclick: () => list[index] = editor.state.cursor() }, text)
		}

		let buffers = mem(() => {
			return buffer.map((b, i) => {
				console.log("buf", i, buffer)
				return buff_btn(i, buffer)
			})

		})

		return [
			h("div.bar", { style: bar_style }, travel, smoothie, curtains, buffers),
			h("div.group", { ref: parent_ref }, () => each(() => state.blocks, bind))
		]
	}
	const PADDING = 100

	return {
		// HERE: Add panzoom
		render: Render,
		onkeydown: handle_keys,
		write: (el) => write(el),
		// TODO: Should take in a block id
		// TODO: and resolve this in here, so if I have 
		// TODO: a scrollable editor, can resolve for it too 
		show: (x, y, w, h) => {
			let rect = {
				bottom: y + h + PADDING,
				left: x - PADDING,
				right: x + w + PADDING,
				top: y - PADDING
			}


			// TODO: Make this tweakable
			if (smooth()) {
				let scale = panzoom?.getTransform().scale
				let _x = -1 * (x - (PADDING / scale)) * scale
				let _y = -1 * (y - (PADDING / scale)) * scale
				panzoom?.smoothMoveTo(_x, _y)
			}

			// Figure out how to make it smoothZoom
			else {
				panzoom?.showRectangle(rect)
				panzoom?.moveBy(0.1, .1)
			}


		}
	};
}

























// ------------------------
// SLIDER ELEMENT
// ------------------------
function slider(state) {
	let val = sig(state.value ? state.value : 0)
	let output = mem(() => `M.slider = ${val()};`)
	eff_on(val, () => {
		if (m()) m().slider = val()
	})

	const renderer = () => {
		return h("div",
			h("input", {
				type: "range",
				oninput: (e) => val.set(e.target.value)
			}
			), h("p", "Value: ", val)
		)
	}

	const write = (el) => {
		el.output = output()
		el.value = val()
	}

	return {
		render: renderer,
		write: write
	}
}
editor.register("slider", slider.toString())

// -----------------------
// SAVE ELEMENT
// ------------------------
function save_editor(state) {
	let path = sig(state.path ? state.path : "")
	let save = () => editor.state.save(path())
	let autosave = sig(state.autosave ? state.autosave : false)

	let autosave_text = mem(() =>
		autosave()
			? "autosave is (ON)"
			: "AUTOSAVE is -> OFF <-"
	)

	let toggle_autosave = () => autosave.set(!autosave())

	const renderer = () => h("div", [
		h("input", {
			type: "text",
			id: "input-" + state.id,
			value: path,
			oninput: (e) => path.set(e.target.value)
		}),
		h("button", { onclick: save }, "OVERWRITE"),
		h("button", { onclick: toggle_autosave }, autosave_text)
	])

	return {
		render: renderer,
		write: (el) => {
			el.path = path();
			el.output = ""
			el.autosave = autosave()
			if (autosave()) save()
		},
		onfocus: () => document.getElementById("input-" + state.id)?.focus(),
		onunfocus: () => document.getElementById("input-" + state.id)?.blur()
	}
}
editor.register("save-component", save_editor.toString())

// -----------------------
// LOAD ELEMENT
// ------------------------
function load_editor(state) {
	console.log("path: ", state.path)
	let path = sig(state.path ? state.path : "")
	let load = () => editor.state.load(path())
	let onkeydown = (e) => e.key == "Enter" ? load() : null

	const renderer = () => h("div", [
		h("input", {
			type: "text",
			id: "input-" + state.id,
			value: path,
			onkeydown: onkeydown,
			oninput: (e) => path.set(e.target.value)
		}),

		h("button", { onclick: load }, "load")
	])

	return {
		render: renderer,
		write: (el) => { el.path = path(); el.output = "" },
		onfocus: () => document.getElementById("input-" + state.id)?.focus(),
		onunfocus: () => document.getElementById("input-" + state.id)?.blur()
	}
}
editor.register("load-component", load_editor.toString())

// -----------------------
// Editor Sizer
// ------------------------
function editor_sizer(state) {
	let size = sig(state.size ? state.size : "100")
	// let set_size = eff_on(size,() => {
	//   if (size() < 20) return
	//   let e_w = parseInt(size())
	//   editor.positioner.w.set(e_w)
	//   editor.iframe_pos.x.set(e_w)
	//   editor.iframe_pos.w.set(100-e_w)
	// })

	const renderer = () => h("div", [h("h1", "NOT SUPPORTING THIS")])

	return {
		render: renderer,
		write: (el) => { el.size = size(); el.output = "" },
		onfocus: () => document.getElementById("input-" + state.id)?.focus(),
		onunfocus: () => document.getElementById("input-" + state.id)?.blur()
	}
}
editor.register("editor_sizer", editor_sizer.toString())

// -----------------------
// Markdown renderer
// ------------------------

function md_renderer(state) {
	let md = sig(state.md ? state.md : "100")
	let focused = mem(() => state.focus ? true : false)
	let id = "input-" + state.id
	let input = () => document.getElementById(id)

	let onfocus = () => input().focus()

	let edit = () => h("textarea", {
		oninput: (e) => md.set(e.target.value),
		id: id,
		value: md,
		style:
			`width: 100%;
       height: 100%;`
	})


	let show = mem(() => focused()
		? edit()
		: h("div", { class: "md" }, MD(md()))
	)

	const renderer = () => {
		return show

	}

	return {
		render: renderer,
		write: (el) => {
			el.md = md();
			el.output = ""
		},
		onfocus: onfocus,
	}
}
editor.register("md", md_renderer.toString())

// ------------------------
// Sandbox Renderer
// ------------------------
function sandbox_renderer(state, i, c) {
	// Sandbox should -> 
	// Have a code editor
	// code editor will output a fn, 
	// that returns (h) html
	// Code should have access to m()

	function evaluate_expression(exp) {
		// Try block to evaluate the expression and handle potential errors
		let result
		try {
			result = eval_code(exp);
		}
		catch (error) {
			if (error instanceof EvalError) console.log('EvalError:', error.message);
			else console.log('Error:', error.message);
		}

		if (result) return result
	}

	const code = mem(() => state?.renderer
		? state?.renderer
		: ` function() {
      return h("div", "hello world ass")
    }
  `)

	const run_code = sig(code())
	const id = uid();
	let save, focus, focus_on_pos;

	const render_fn = () => {
		mounted(() => {
			let extensions = [keymap.of([
				{
					key: "Mod-Shift-l",
					run: (e) => {
						run_code.set(e.state.doc.toString())
					}
				}
			])]

			const cm_editor = make_code_mirror(code(), id, extensions);
			focus = () => setTimeout(() => cm_editor.focus(), 100);
			save = function(el) {
				// TODO: add "\n" only when not already added... 
				// TODO: Also mirro mechanism where else doc is accessed.
				const text = cm_editor.state.doc.toString()
				el.output = ""
				el.focused = cm_editor.hasFocus;
				el.renderer = text;
				el.cursor = cm_editor.state.selection.ranges[0].from;
				run_code.set(text)
			};

			defer(function() {
				if (state.cursor && state.focused) {
					const selection = { anchor: state.cursor, head: state.cursor };
					cm_editor.focus();
					cm_editor.dispatch({ selection });
				}
			});

			eff_on(run_code, () => { render_code(run_code) })
		});

		function render_code(code) {
			// TODO: Make it so maybe_renderer 
			// can access state, pass in state...
			if (code()) {
				let elem = document.querySelector(".output-" + id)
				elem.innerHTML = ""
				let maybe_renderer = evaluate_expression(code())
				if (typeof maybe_renderer == "function") {
					render(maybe_renderer, elem)
				}
			}
		}

		let overflow = `overflow-y: scroll;height: 100%;`

		return h("div",
			{
				style: `
          display: grid;
          grid-template-rows: 40% 60%;
          height: 95%;
          overflow: hidden;
        `},
			h("div", { class: "output-" + id, style: overflow }),
			h("div", { class: "editor-" + id, style: overflow })
		)
	};

	// TODO: COMPONENT: template object representation
	// should have icons for things and have intellisense...
	return ({
		render: render_fn,
		onfocus: () => focus(),
		write: (...args) => save(...args),
	});
}

editor.register("sandbox", sandbox_renderer.toString())

// ------------------------
// Custom Renderer
// ------------------------
function custom_renderer(state, i, c) {
	if (state.renderer) return eval_code(state.renderer)(state, i, c)

	const code = mem(() => state?.renderer
		? state?.renderer
		: custom_renderer.toString())

	const id = uid();
	let save, focus, focus_on_pos;

	Vim.defineEx("write", "w", () => editor.state.write());

	const render = () => {
		mounted(() => {
			let extensions = []
			const cm_editor = make_code_mirror(code(), id, extensions);
			focus = () => setTimeout(() => cm_editor.focus(), 100);
			save = function(el) {

				// TODO: add "\n" only when not already added... 
				// TODO: Also mirro mechanism where else doc is accessed.
				const text = cm_editor.state.doc.toString()
				el.output = ""
				el.focused = cm_editor.hasFocus;
				el.renderer = text;
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

editor.register("custom", custom_renderer.toString())

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

	keys.on("j", (_) => state.next());
	keys.on("k", (_) => state.prev());

	keys.on("shift+c", (_) => add_block({ type: "code" }, state));
	keys.on("shift+g", (_) => add_block({ type: "group" }, state));
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
		//TODO : FUCKING FIX THIS
		state.start = el.start
		el.output = output;
		el.blocks = state.blocks;
	};

	const focus_on_position = (pos) => {
		state.focus_on_pos(pos)
	}


	return {
		render: () => h(
			"div.group",
			() => each(() => state.blocks, bind)
		),
		onkeydown: handle_keys,
		write: (el) => write(el),
		handle_unfocus: _unfocus,
		focus_on_pos: focus_on_position
	};
}

editor.register("group", GroupRenderer.toString())

































































// ------------------------
// CODEMIRROR ELEMENT
// ------------------------
function code_element(state, index, control) {
	const code = mem(() => state?.output ? state?.output : "");

	// only used for syncing with tsserver
	const live_code = sig("")
	const id = uid();
	let save, focus, focus_on_pos;

	Vim.defineEx("write", "w", () => editor.state.write());

	Vim.defineEx("cm", "cm", (cm) => {
		console.log(cm.cm6)
		let s = cm.cm6.state.wordAt(3)
		let r = cm.cm6.state.sliceDoc(s.from, s.to)
		console.log(s)
		console.log(r)
	});

	// VIM Folding
	Vim.defineAction("toggleFold", (cm) => toggleFold(cm.cm6))
	Vim.defineAction("foldAll", (cm) => foldAll(cm.cm6))

	Vim.mapCommand("zc", "action", "toggleFold", {}, { context: "normal" });
	Vim.mapCommand("zo", "action", "toggleFold", {}, { context: "normal" });
	Vim.mapCommand("zM", "action", "foldAll", {}, { context: "normal" });

	const live_output = mem(() => {
		if (state.focus) {
			let code_map = {}
			code_map[state.id] = live_code()

			// TODO: CLean this up
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
			const cursorTooltipBaseTheme = EditorView.baseTheme({
				".cm-tooltip.cm-tooltip-cursor": {
					backgroundColor: "#66b",
					color: "white",
					border: "none",
					padding: "2px 7px",
					borderRadius: "4px",
					"& .cm-tooltip-arrow:before": {
						borderTopColor: "#66b"
					},
					"& .cm-tooltip-arrow:after": {
						borderTopColor: "transparent"
					}
				}
			})


			let def = sig("")
			let dom_ref = undefined
			let hover = sig(true)
			let definition_pos = sig(null)

			function get_cursor_tooltips(_state) {
				// TODO: Rewrite to throttle and also not map all selections
				// TODO: and only first one...
				return _state.selection.ranges
					.map(range => {

						let line = _state.doc.lineAt(range.head)

						// *****************************
						// TODO: Throttle this, runs too many times 
						// *****************************
						if (hover()) {
							let start = state.start ? state.start : 0
							let p = start + range.head

							control.state.quick_info(p).then((res) => {
								if (res) dom_ref.textContent = res
							})
						}

						return {
							pos: range.head,
							above: true,
							strictSide: true,
							arrow: true,
							create: () => {
								let dom = document.createElement("div")
								dom.className = "cm-tooltip-cursor"
								dom.textContent = def()
								dom.style.display = hover() ? "" : "none"
								dom_ref = dom
								return { dom }
							}
						}
					})[0]

			}
			const cursorTooltipField = StateField.define({
				create: get_cursor_tooltips,

				update: function(tooltips, tr) {
					if (!tr.docChanged && !tr.selection && !hover()) return tooltips
					return get_cursor_tooltips(tr.state)
				},

				provide: f => hover() ? showTooltip.compute([f], state => state.field(f)) : null
			})
			function tooltip() {
				return [cursorTooltipField, cursorTooltipBaseTheme]
			}

			let extensions = [
				tooltip(),
				linter(() => {
					let start = state.start ? state.start : 0
					let end = start + live_code().length
					return control.state.lint(start, end)
				}),

				keymap.of([
					{
						key: "Mod-Shift-i",
						run: () => {
							hover.set(!hover())
							if (dom_ref) dom_ref.style.display = hover() ? "" : "none"
						}
					},
					{
						key: "Mod-Shift-u",
						run: (e) => {
							// get references from editor for cur position, then tell 
							// editor to focus there
							let start = state.start ? state.start : 0
							control
								.state
								.find_definition(e.state.selection.ranges[0].head + start)
								.then((pos) => {
									if (pos) editor.state.focus_on_pos(pos)
								})
						}
					},
				]),

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


				EditorView.updateListener.of(throttle((e) => live_code.set(e.state.doc.toString() + "\n"), 100))
			]

			const cm_editor = make_code_mirror(code(), id, extensions);
			focus = () => setTimeout(() => cm_editor.focus(), 100);

			save = function(el) {
				// TODO: add "\n" only when not already added... 
				// TODO: Also mirro mechanism where else doc is accessed.
				const text = cm_editor.state.doc.toString() + "\n"
				el.focused = cm_editor.hasFocus;
				el.output = text;
				el.cursor = cm_editor.state.selection.ranges[0].from;
			};

			focus_on_pos = (pos) => {
				let start = state.start ? state.start : 0

				cm_editor.dispatch({
					selection: { anchor: pos - start, head: pos - start },
					scrollIntoView: true
				})

				focus()
			}

			defer(function() {
				hover.set(false)
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
		focus_on_pos: (pos) => focus_on_pos(pos)
	});
}
editor.register("code", code_element.toString());



















































// ------------------------
// CODEMIRROR UTILS
// ------------------------
function make_code_mirror(source, id, extensions, language = javascript) {
	const element = document.querySelector(".editor-" + id);
	const state = {
		doc: source,
		extensions: [
			vim(),
			language(),

			basicSetup,
			theme,

			keymap.of([
				indentWithTab,
				{
					key: "Mod-e",
					run: () => toggleFold(editor)
				},
				{
					key: "Mod-shift-e",
					run: () => foldAll(editor)
				},
				{
					key: "Escape",
					run: () => {
						editor.contentDOM.blur();
						window.getSelection()?.removeAllRanges();
					},
				},
			]),
			...extensions,
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
			"&.cm-focused .cm-fat-cursor": {
				background: settings.caret,

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
	variant: "dark",
	settings: {
		background: BACKGROUND,
		foreground: FOREGROUND,
		caret: "yellow",
		selection: "#ffffff26",
		gutterBackground: "#fcfcfc22",
		gutterForeground: "#8a919922",
		lineHighlight: "#8a919922",
	},
	styles: [
		{
			tag: t.comment,
			color: "#00000066",
		},
		{
			tag: t.string,
			color: "#7EB282",
		},
		{
			tag: t.regexp,
			color: "#4cbf99",
		},
		{
			tag: [t.number, t.bool, t.null],
			color: "yellow",
			"background-color": "#0002"
		},
		{
			tag: t.variableName,
			color: "#7E74BC",
		},
		{
			tag: [t.definitionKeyword, t.modifier],
			color: "#FF7B72",
		},
		{
			tag: [t.keyword, t.special(t.brace)],
			color: "#FF7B72",
		},
		{
			tag: t.operator,
			color: "grey",
		},

		{
			tag: t.separator,
			color: "grey",
		},
		{
			tag: t.punctuation,
			color: "grey"
		},
		{
			tag: [t.definition(t.propertyName), t.function(t.variableName)],
			color: "#7E74BC",
			"font-family": "hermit",
		},
		{
			tag: [t.className, t.definition(t.typeName)],
			color: "orange",
		},
		{
			tag: [t.tagName, t.typeName, t.self, t.labelName],
			color: "grey",
		},
		{
			tag: t.angleBracket,
			color: "violet",
		},
		{
			tag: t.attributeName,
			color: "#F66BAC",
		},
	],
});

render(Root, document.body);













































































































console.log("this is a group")













































console.log("I have to fix group styles, they are position absolute right now....")













































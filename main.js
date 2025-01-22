import fs from "fs"
import markdownIt from "./markdown-it/markdown-it.js";
import { auth } from "./auth.js"
import makrdownItMark from "./markdown-it/markdown-it-mark.js";

// ********************************
// SECTION : Are.na Utilities
// ********************************
//
// let host = "https://api.are.na/v2"
let host = "http://localhost:3000/api"
let options = {
	headers: {
		Authorization: `Bearer ${auth}`,
		cache: "no-store",
		"Cache-Control": "max-age=0, no-cache",
		referrerPolicy: "no-referrer",
	},
}

const fetch_json = (link, options) => fetch(link, options).then(r => r.json())
const get_channel = (slug) => fetch_json(host + "/channels/" + slug, options)
const get_block = (id) => fetch_json(host + "/blocks/" + id, options)

// ********************************
// SECTION : Rendering for Special Components
// ********************************
//
const video = (block) => `<video src=${block.attachment.url} autoplay controls loop></video> `
const image = (block) => `<img src=${block.image.display.url} />`

async function run() {
	let channel = await get_channel("blog-feed?force=true")
	channel.contents = channel.contents.sort((a, b) => b.position - a.position)

	let html = await create_html(channel)

	write_html(html)
}

async function create_html(channel) {
	let html = ''

	for await (const block of channel.contents) {
		if (block.class == "Text") {
			let date = block.title
			let content = await MD(block.content)

			content = content.flat().join('\n')

			html += `
				<div class="block" onclick="(() => {console.log('this website no have js')})()">
					<p class="date">${date}</p>
					${content}
				</div>
			`
		}
	}

	return html
}

function write_html(html) {
	let html_full = `
		<!DOCTYPE html>
		<html>
			<head>
				<link rel="stylesheet" href="./style.css">
			</head> 
		<body>
			<div class="block">
				<a href="https://github.com/caizoryan/feed.a-p">about</a>
			</div>
			${html}
		</body>
		</html>`

	fs.writeFileSync("index.html", html_full)
}



// ********************************
// SECTION : MARKDOWN RENDERING
// ********************************
let md = new markdownIt().use(makrdownItMark);

let attrs = (item) => {
	let attrs = item.attrs;
	if (!attrs) return "";
	return Object.fromEntries(attrs);
};

const link_is_block = (link) => {
	return link.includes("are.na/block");
};

const extract_block_id = (link) => {
	return link.split("/").pop();
};


async function eat(tree) {
	let ret = [];

	if (!tree) return "";

	while (tree.length > 0) {
		let item = tree.shift();

		if (item.nesting === 1) {
			let at = attrs(item);
			let ignore = false

			if (at.href && link_is_block(at.href)) {
				let id = extract_block_id(at.href)
				let block = await get_block(id)

				if (
					block.class == "Attachment" &&
					block.attachment.extension == "mp4"
				) {
					ret.push(video(block))
					let word = await eat(tree)
					ignore = true
				}

				if (
					block.class == "Image"
				) {
					ret.push(image(block))
					let word = await eat(tree)
					ignore = true
				}
			}

			let at_string =
				// convert attribute (in object form)
				// to an html stringified attribute form
				Object.entries(at)
					.map(([key, value]) => `${key} = "${value}"`)
					.join(" ")

			if (!ignore) {
				let children = await eat(tree)
				children = Array.isArray(children) ? children.join("") : children
				ret.push(`<${item.tag} ${at_string}> ${children} </${item.tag}>`)
			}

		}

		if (item.nesting === 0) {
			if (!item.children || item.children.length === 0) {
				let p = item.type === "softbreak" ? "<br></br>" : item.content
				ret.push(p);
			} else {
				let children = await eat(item.children)
				children = Array.isArray(children) ? children.join("") : children
				ret.push(children);
			}
		}

		if (item.nesting === -1) { break; }
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

const MD = async (content) => {
	let tree = safe_parse(content);

	let body;

	if (tree) body = await eat(tree);
	else body = content;


	return body;
};

run()

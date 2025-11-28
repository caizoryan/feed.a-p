import fs from "fs";
import markdownIt from "./markdown-it/markdown-it.js";
import { auth } from "./auth.js";
import makrdownItMark from "./markdown-it/markdown-it-mark.js";

// ********************************
// SECTION : Are.na Utilities
// ********************************
//
// let host = "https://api.are.na/v2"
let host = "http://localhost:3000/api";
let options = {
	headers: {
		Authorization: `Bearer ${auth}`,
		cache: "no-store",
		"Cache-Control": "max-age=0, no-cache",
		referrerPolicy: "no-referrer",
	},
};

const fetch_json = (link, options) =>
	fetch(link, options).then((r) => r.json());
const get_channel = (slug) => {
	console.log("getting", slug)
	return fetch_json(host + "/channels/" + slug, options)
}
const get_block = (id) => fetch_json(host + "/blocks/" + id, options);

let link_svg =
	`<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8.51194 3.00541C9.18829 2.54594 10.0435 2.53694 10.6788 2.95419C10.8231 3.04893 10.9771 3.1993 11.389 3.61119C11.8009 4.02307 11.9513 4.17714 12.046 4.32141C12.4633 4.95675 12.4543 5.81192 11.9948 6.48827C11.8899 6.64264 11.7276 6.80811 11.3006 7.23511L10.6819 7.85383C10.4867 8.04909 10.4867 8.36567 10.6819 8.56093C10.8772 8.7562 11.1938 8.7562 11.389 8.56093L12.0077 7.94221L12.0507 7.89929C12.4203 7.52976 12.6568 7.2933 12.822 7.0502C13.4972 6.05623 13.5321 4.76252 12.8819 3.77248C12.7233 3.53102 12.4922 3.30001 12.1408 2.94871L12.0961 2.90408L12.0515 2.85942C11.7002 2.508 11.4692 2.27689 11.2277 2.11832C10.2377 1.46813 8.94398 1.50299 7.95001 2.17822C7.70691 2.34336 7.47044 2.57991 7.1009 2.94955L7.058 2.99247L6.43928 3.61119C6.24401 3.80645 6.24401 4.12303 6.43928 4.31829C6.63454 4.51355 6.95112 4.51355 7.14638 4.31829L7.7651 3.69957C8.1921 3.27257 8.35757 3.11027 8.51194 3.00541ZM4.31796 7.14672C4.51322 6.95146 4.51322 6.63487 4.31796 6.43961C4.12269 6.24435 3.80611 6.24435 3.61085 6.43961L2.99213 7.05833L2.94922 7.10124C2.57957 7.47077 2.34303 7.70724 2.17788 7.95035C1.50265 8.94432 1.4678 10.238 2.11799 11.2281C2.27656 11.4695 2.50766 11.7005 2.8591 12.0518L2.90374 12.0965L2.94837 12.1411C3.29967 12.4925 3.53068 12.7237 3.77214 12.8822C4.76219 13.5324 6.05589 13.4976 7.04986 12.8223C7.29296 12.6572 7.52943 12.4206 7.89896 12.051L7.89897 12.051L7.94188 12.0081L8.5606 11.3894C8.75586 11.1941 8.75586 10.8775 8.5606 10.6823C8.36533 10.487 8.04875 10.487 7.85349 10.6823L7.23477 11.301C6.80777 11.728 6.6423 11.8903 6.48794 11.9951C5.81158 12.4546 4.95642 12.4636 4.32107 12.0464C4.17681 11.9516 4.02274 11.8012 3.61085 11.3894C3.19896 10.9775 3.0486 10.8234 2.95385 10.6791C2.53661 10.0438 2.54561 9.18863 3.00507 8.51227C3.10993 8.35791 3.27224 8.19244 3.69924 7.76544L4.31796 7.14672ZM9.62172 6.08558C9.81698 5.89032 9.81698 5.57373 9.62172 5.37847C9.42646 5.18321 9.10988 5.18321 8.91461 5.37847L5.37908 8.91401C5.18382 9.10927 5.18382 9.42585 5.37908 9.62111C5.57434 9.81637 5.89092 9.81637 6.08619 9.62111L9.62172 6.08558Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg>`;

// ********************************
// SECTION : Rendering for Special Components
// ********************************
//
const media_embed = (block) =>
	`<span class="media">${block.embed?.html}</span>`;

const media = (block) => `
	<a href=${block?.source?.url}>
		<div class="media">
			<p class="title">${block.title}</p>
			<img src="${block.image.display.url}" />
			<p class="metadata">${block.source?.url}</p> 
		</div>
	</a>
`;

const video = (block) =>
	`<video src=${block.attachment.url} controls loop></video> `;
const image = (block) => `<img src="${block.image.display.url}" />`;
const link = (block) =>
	`<span class="link"> <a target="_blank" href=${block.source.url}>${block.title} ${link_svg}</a> </span>`;

const pdf = (block) => `
	<a target="_blank" href=${block.attachment.url}>
		<p class="pdf">
			<span>
			${block.title} ${link_svg}
			</span>
			<img src="${block.image.display.url}" />
		</p>
	</a>
`;

const channel = c => `
	<a target="_blank" href=./${c.slug}>
		<p class="channel">
			<span> ${c.title} </span>
		</p>
	</a>
`

let force = 'force=true&'
force = ''
async function run() {
	let channel = await get_channel("blog-feed?"+force+"per=300");
	let channels = []
	let channel_slugs = channel.contents.filter(e => e.class == 'Channel')

	channel.contents = channel.contents.sort((a, b) => b.position - a.position);

	let html = await create_html(channel);

	for (const slug of channel_slugs) {
    const c = await get_channel(slug.slug+"?"+force+"per=300");
		c.contents = c.contents.sort((a, b) => a.position - b.position);
		console.log("Got: ", c.slug)
		channels.push(c)
  }
	
	let links = channels.map(e => ({
		href: './'+e.slug+'.html',
		title: e.title.replace('[FEED] ', '')
	}))

	write_html(html, 'index.html', links);

	for (const c of channels) {
		console.log("Creating HTML file for:", c.slug)
    const h = await create_html(c)
		write_html(h, c.slug+'.html', links);
  }
}

let padd_zero = (num) => num < 10 ? "0" + num : num;

let time_string = (time) => {
	let week = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	let date = time.getDate();
	let month = time.getMonth();
	let day = time.getDay();
	let hours = time.getHours();
	let minutes = time.getMinutes();
	return `${date} ${months[month]}, ${week[day]}, ${padd_zero(hours)}:${padd_zero(minutes)}`;
};

let months = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

let date_string = (time) => {
	let date = time.getDate();
	let month = time.getMonth();
	let year = time.getFullYear();

	return `${date} ${months[month]} ${year}`;
};

let month = (time) => {
	let month = time.getMonth();
	return months[month];
};

async function create_html(channel) {
	console.log("Length: ", channel.contents.length)
	let html = `
			<label for="html" class="fixed t1">1100px</label>
		  <input type="radio" name="any" value="HTML" class="fixed t1">

			<label for="b" class="fixed t2">800px</label>
		  <input type="radio" checked name="any" value="b" class="fixed t2">

			<label for="c" class="fixed t3">500px</label>
		  <input type="radio" name="any" value="c" class="fixed t3">

			<label for="c" class="fixed t4">unskew</label>
		  <input type="radio" name="dawg" value="c" class="fixed t4">
			<label for="c" class="fixed t5">skew</label>
		  <input type="radio" name="dawg" value="c" class="fixed t5">
`;
	let options = ["mt5", "mt10", "mt15", "mt20", "mt25", "mt30"]

	let lastmonth = "";

	let channels = []

	for await (const block of channel.contents) {
		if (block.class == "Text") {
			if (block.title == "DRAFT") continue;

			let date = block.title;
			let updated_at = new Date(block.updated_at);
			let updated_at_string = time_string(updated_at);

			let created_at = new Date(block.created_at);
			let created_at_string = time_string(created_at);
			if (date == "") date = date_string(created_at)

			let content = await MD(block.content);
			let m = month(new Date(date));

			if (months.includes(m) && m != lastmonth) {
				html += `
				<div class="block month mt30">
					<h1>${m}</h1>
				</div>
			`;
			}

			if (months.includes(m)) lastmonth = m

			content = content.flat().join("\n");
			html += `
				<div class="block ${options[Math.floor(Math.random() * options.length)]}">
					<p class="date">${date}</p>
					<span class="metadata">updated_at: ${updated_at_string}</span>
					<span class="metadata">posted_on: ${created_at_string}</span>
					${content}

				</div>
			`;

		}
		else if (block.class == "Channel") { channels.push(block) }
	}

	return html;
}

function write_html(html, file, links=[]) {
	let html_full = `
		<!DOCTYPE html>
		<html>
			<head>
				<link rel="stylesheet" href="./style.css">
			</head> 
		<body>

			<div class='nav'>
				<a href="https://github.com/caizoryan/feed.a-p">about</a>
				${links.map(e => `<p><a href=${e.href}>${e.title}</a></p>`).join('')}
			</div>
			${html}
		</body>
		</html>`;

	fs.writeFileSync(file, html_full);
}

// ********************************
// SECTION : MARKDOWN RENDERING
// ********************************
let md = new markdownIt('commonmark')//.use(makrdownItMark);

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
			let ignore = false;

			if (at.href && link_is_block(at.href)) {
				let id = extract_block_id(at.href);
				let block = await get_block(id);

				// --------------------------------
				// Attachment
				// --------------------------------
				if (block.class == "Attachment") {

					if (block.attachment.extension == "mp4") {
						ret.push(video(block));
					} else if (block.attachment.extension == "pdf") {
						ret.push(pdf(block));
					}
					let word = await eat(tree);
					ignore = true;

				}

				// --------------------------------
				// Media
				// --------------------------------
				else if (block.class == "Media") {

					if (block.class == "Media" && block.embed) {
						ret.push(media_embed(block));
					} else ret.push(media(block));
					let word = await eat(tree);
					ignore = true;

				}

				// --------------------------------
				// Image
				// --------------------------------
				else if (block.class == "Image") {
					ret.push(image(block));
					let word = await eat(tree);
					ignore = true;
				}


				// --------------------------------
				// Link
				// --------------------------------
				else if (block.class == "Link") {

					ret.push(link(block));
					let word = await eat(tree);
					ignore = true;

				}
			}

			let entries = Object.entries
			let at_string =
				// convert attribute (in object form)
				// to an html stringified attribute form
				entries(at)
					.map(([key, value]) => `${key} = "${value}"`)
					.join(" ");

			if (!ignore) {
				let children = await eat(tree);
				children = Array.isArray(children) ? children.join("") : children;

				if (debug_print) {
					console.log("---\nxxx\ntag:\nxxx\nx----\n", item.tag)
					// 	console.log("---\nxxx\nitem:\nxxx\n----\n", item)
				}

				ret.push(`<${item.tag} ${at_string}> ${children} </${item.tag}>`);
			}
		}

		if (item.nesting === 0) {
			if (!item.children || item.children.length === 0) {
				let p = item.type === "softbreak"
					? "<br></br>"
					: item.type === "fence"
						? `<xmp>${item.content}</xmp>`
						: item.content;
				ret.push(p);
			} else {
				if (debug_print) {
					// console.log("---\ntype:\n----\n", item.type)
					//console.log("---\ncontent:\n----\n", item.content)
				}
				let children = await eat(item.children);
				children = Array.isArray(children) ? children.join("") : children;
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

let debug_print = false
const MD = async (content) => {

	// if (content.includes('# How templater work')) debug_print = true
	// else debug_print = false

	let tree, body;
	tree = safe_parse(content);

	// if (debug_print) {
	// 	fs.writeFileSync("templater.md", content)
	// 	let templater = fs.readFileSync("./templater.md", { encoding: "utf-8" })
	// 	tree = safe_parse(templater);
	// 	console.log(tree)
	// }

	// else {
	// }

	if (tree) body = await eat(tree);
	else body = content;

	if (debug_print) {
		//console.log('body', body)
		//	console.log("content:", content)
	}

	return body;
};

// let test = fs.readFileSync("./templater.md", { encoding: "utf-8" })
// let parsed = md.parse(test)
// console.log(parsed)


run();

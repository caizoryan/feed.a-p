import { parseHTML } from "linkedom";
import { renderMarkdown } from "./components.js";
import { formatDate, formatTime, MONTHS, monthName } from "./utils.js";

export function textPreview(html, wordLimit = 40) {
	const { document } = parseHTML(`<div>${html.replace(/<\/(p|h[1-6]|li|blockquote)>/gi, " </$1>")}</div>`);
	const root = document.querySelector("div");
	for (const node of root.querySelectorAll(".image, .media, .pdf, .metadata, .date, img, video, iframe, script, style")) node.remove();
	if (root.firstElementChild?.matches("h1, h2, h3")) root.firstElementChild.remove();
	const text = root.textContent.trim().split(/\s+/).filter(Boolean).slice(0, wordLimit).join(" ");
	return `${text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}…`;
}

export function postPreview(content, slice = 5) {
	const excerpt = content.split("\n").slice(0, slice).join("\n");
	const { document } = parseHTML(`<div>${content}</div>`);
	const media = Array.from(document.querySelectorAll(".image, .media, .pdf"))
		.filter((node) => !node.parentElement.closest(".image, .media, .pdf"))
		.filter((node) => {
			const src = node.querySelector("[src]")?.getAttribute("src");
			return !src || !excerpt.includes(src.replaceAll("&", "&amp;")) && !excerpt.includes(src);
		})
		.map((node) => node.outerHTML);
	const safeExcerpt = parseHTML(excerpt).document.toString();
	return `${safeExcerpt}${media.length ? `<div class="image-thumbnails post-media">${media.join("\n")}</div>` : ""}`;
}

export async function renderChannel(channel, { slice = 5 } = {}) {
	let html = "";
	const blockPages = [];
	let lastMonth = "";

	for (const block of channel.contents ?? []) {
		if (block.type !== "Text") continue;
		if (block.title?.toUpperCase() === "DRAFT" || block.title?.toLowerCase() === ".canvas") continue;

		const updatedAt = new Date(block.updated_at);
		const createdAt = new Date(block.created_at);
		const date = block.title ?? formatDate(createdAt);
		const thumbnails = [];
		const content = await renderMarkdown(block.content?.markdown ?? "", thumbnails);
		const contentLines = content.split("\n");
		const contentSliced = postPreview(content, slice);
		const currentMonth = monthName(new Date(date));

		if (MONTHS.includes(currentMonth) && currentMonth !== lastMonth) {
			html += `<div class="block month mt30"><h1>${currentMonth}</h1></div>`;
		}
		if (MONTHS.includes(currentMonth)) lastMonth = currentMonth;

		html += `
			<div class="block-list">
				<a href="./blocks/${block.id}.html"><h1>${contentLines[0] ?? ""}</h1></a>
				<div class="image-thumbnails"><a class="text-thumbnail" href="./blocks/${block.id}.html"><p>${textPreview(content)}</p></a>${thumbnails.join("\n")}</div>
			</div>
			<div class="block">
				<p class="date">${date}</p>
				<span class="metadata">updated_at: ${Number.isNaN(updatedAt.getTime()) ? "" : formatTime(updatedAt)}</span>
				<span class="metadata">posted_on: ${Number.isNaN(createdAt.getTime()) ? "" : formatTime(createdAt)}</span>
				${contentSliced}
				<a class="see-more" href="./blocks/${block.id}.html">See More</a>
			</div>
		`;
	    blockPages.push({
	      id: block.id,
	      html: `<div class="block">${content}</div>`,
	    });
	}

	return { html, blockPages };
}

export const viewOptions = `
		<div class="view-options">
			<h4>View</h4>
			<div class="option-group">
				<button type="button" data-width="1100">1100px</button>
				<button type="button" data-width="800">800px</button>
				<button type="button" data-width="500">500px</button>
			</div>
			<div class="option-group">
				<button type="button" data-view="grid">normal</button>
				<button type="button" data-view="list">list</button>
			</div>
		</div>`;

export function wrapPage(html, { links = "", isIndex = false } = {}) {
	return `<!DOCTYPE html>
<html>
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<link rel="icon" type="image/x-icon" href="https://a-p.space/favicon.ico">
		<link rel="stylesheet" href="/style.css">
		${isIndex ? '<link rel="alternate" type="application/rss+xml" href="/feed.xml" title="Aaryan\'s Feed">' : ""}
	</head>
	<body>
		<header class="site-header">
		<button class="menu-toggle" type="button" aria-controls="sidebar" aria-expanded="false">
			<span>feed.a-p.space</span>
			<svg class="menu-chevron" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
		</button>
		<div class="menu-content">
		<aside class="panel" id="sidebar" inert>
			<h4>Pages</h4>
			<p><a href="/">home</a></p>
			<p><a href="https://github.com/caizoryan/feed.a-p">about</a></p>
			${links}
			${viewOptions}
		</aside>
		</div>
		</header>
		<main class="container" data-width="800" data-view="grid">${html}</main>
		<script src="/script.js" defer></script>
	</body>
</html>`;
}

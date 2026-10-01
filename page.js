import { renderMarkdown } from "./components.js";
import { formatDate, formatTime, MONTHS, monthName } from "./utils.js";

export async function renderChannel(channel, { slice = 5 } = {}) {
	let html = `
		<label for="html" class="fixed t1">1100px</label>
		<input type="radio" name="any" value="HTML" class="fixed t1">
		<label for="b" class="fixed t2">800px</label>
		<input type="radio" name="any" value="b" class="fixed t2">
		<label for="c" class="fixed t3">500px</label>
		<input type="radio" checked name="any" value="c" class="fixed t3">
		<label for="c" class="fixed t4">normal</label>
		<input type="radio" checked name="dawg" value="c" class="fixed t4">
		<label for="c" class="fixed t5">list</label>
		<input type="radio" name="dawg" value="c" class="fixed t5">
	`;
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
		const contentSliced = contentLines.slice(0, slice).join("\n");
		const currentMonth = monthName(new Date(date));

		if (MONTHS.includes(currentMonth) && currentMonth !== lastMonth) {
			html += `<div class="block month mt30"><h1>${currentMonth}</h1></div>`;
		}
		if (MONTHS.includes(currentMonth)) lastMonth = currentMonth;

		html += `
			<div class="block-list">
				<a href="./blocks/${block.id}.html"><h1>${contentLines[0] ?? ""}</h1></a>
				${thumbnails.length ? `<div class="image-thumbnails">${thumbnails.join("\n")}</div>` : ""}
			</div>
			<div class="block">
				<p class="date">${date}</p>
				<span class="metadata">updated_at: ${Number.isNaN(updatedAt.getTime()) ? "" : formatTime(updatedAt)}</span>
				<span class="metadata">posted_on: ${Number.isNaN(createdAt.getTime()) ? "" : formatTime(createdAt)}</span>
				${contentSliced}
				<a href="./blocks/${block.id}.html"> See more </a>
			</div>
		`;
		blockPages.push({ id: block.id, html: `<div class="block">${content}</div>` });
	}

	return { html, blockPages };
}

export function wrapPage(html, { links = "", isIndex = false } = {}) {
	return `<!DOCTYPE html>
<html>
	<head>
		<link rel="icon" type="image/x-icon" href="https://a-p.space/favicon.ico">
		<link rel="stylesheet" href="/style.css">
		${isIndex ? '<link rel="alternate" type="application/rss+xml" href="/feed.xml" title="Aaryan\'s Feed">' : ""}
	</head>
	<body>
		<div class="nav">
			<h4>Pages</h4>
			<p><a href="/">home</a></p>
			<p><a href="https://github.com/caizoryan/feed.a-p">about</a></p>
			${links}
		</div>
		${html}
	</body>
</html>`;
}

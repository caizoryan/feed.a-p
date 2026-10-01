import { renderMarkdown } from "./components.js";
import { stripHtml } from "./utils.js";

export async function createRssItems(blocks, { limit = 42 } = {}) {
	const items = [];
	for (const block of (blocks ?? []).filter((item) => item.type === "Text")) {
		if (items.length >= limit) break;
		if (block.title?.toUpperCase() === "DRAFT" || block.title?.toLowerCase() === ".canvas") continue;

		const content = await renderMarkdown(block.content?.markdown ?? "");
		const lines = content.split("\n");
		let description = lines.slice(1).join("\n").replaceAll("<video", '<video style="max-width: 500px; width:100%;"');
		description = description.replaceAll("]]>", "]]]]><![CDATA[>");
		const title = stripHtml(lines[0] ?? "");
		items.push(`
		<item>
			<title>${title}</title>
			<link>https://feed.a-p.space/blocks/${block.id}.html</link>
			<description><![CDATA[${description}]]></description>
			<pubDate>${new Date(block.created_at).toUTCString()}</pubDate>
			<author>Aaryan Pashine</author>
		</item>`);
	}
	return items;
}

export function renderRss(items) {
	return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
	<channel>
		<title>Aaryan's Feed</title>
		<link>https://feed.a-p.space/</link>
		<description>Stuff coming out the workshop</description>
		<language>en-us</language>
		<pubDate>${new Date().toUTCString()}</pubDate>
		${items.join("\n")}
	</channel>
</rss>
`;
}

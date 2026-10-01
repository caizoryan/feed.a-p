import markdownIt from "./markdown-it/markdown-it.js";
import { getBlock } from "./arena.js";

const markdown = new markdownIt("commonmark");
const linkSvg = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 5H4.5a3 3 0 0 0 0 6H6m3-6h1.5a3 3 0 0 1 0 6H9M5.5 7.5h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`;

const imageSrc = (block, size = "large") => block.image?.[size]?.src ?? block.image?.src ?? "";
const mediaEmbed = (block) => `<span class="media">${block.embed?.html ?? ""}</span>`;
const media = (block) => `<a href="${block.source?.url ?? "#"}"><div class="media"><p class="title">${block.title ?? ""}</p><img src="${imageSrc(block)}" /><p class="metadata">${block.source?.url ?? ""}</p></div></a>`;
const video = (block) => `<div class="media"><video src="${block.attachment?.url ?? ""}" loading="lazy" controls loop></video></div>`;
const image = (block) => `<div class="image"><img loading="lazy" src="${imageSrc(block)}" /></div>`;
const thumb = (block) => `<div class="image"><img loading="lazy" src="${imageSrc(block, "small")}" /></div>`;
const link = (block) => `<span class="link"><a target="_blank" href="${block.source?.url ?? "#"}">${block.title ?? ""} ${linkSvg}</a></span>`;
const pdf = (block) => `<a target="_blank" href="${block.attachment?.url ?? "#"}"><p class="pdf"><span>${block.title ?? ""} ${linkSvg}</span><img src="${imageSrc(block)}" /></p></a>`;

function tokenAttributes(token) {
	return Object.fromEntries(token.attrs ?? []);
}

function attributesToHtml(attributes) {
	return Object.entries(attributes)
		.map(([key, value]) => `${key}="${String(value).replaceAll('"', "&quot;")}"`)
		.join(" ");
}

function isArenaBlockUrl(url = "") {
	return url.includes("are.na/block");
}

async function transformArenaBlock(id, thumbnails) {
	const block = await getBlock(id);
	if (block.type === "Attachment") {
		if (block.attachment?.file_extension === "mp4") {
			if (thumbnails && block.image) thumbnails.push(image(block));
			return video(block);
		}
		if (block.attachment?.file_extension === "pdf") return pdf(block);
	}
	if (block.type === "Embed") return block.embed ? mediaEmbed(block) : media(block);
	if (block.type === "Image") {
		const result = image(block);
		if (thumbnails) thumbnails.push(result);
		return result;
	}
	if (block.type === "Link") return link(block);
	return "";
}

async function renderTokens(tokens, thumbnails) {
	const rendered = [];
	while (tokens.length) {
		const token = tokens.shift();
		if (token.nesting === -1) break;

		if (token.nesting === 1) {
			const attributes = tokenAttributes(token);
			const url = attributes.href;
			if (token.tag === "a" && isArenaBlockUrl(url)) {
				const id = url.split("/").filter(Boolean).at(-1);
				rendered.push(await transformArenaBlock(id, thumbnails));
				let nesting = 1;
				while (tokens.length && nesting) {
					const child = tokens.shift();
					nesting += child.nesting ?? 0;
				}
				continue;
			}

			const children = await renderTokens(tokens, thumbnails);
			const attrs = attributesToHtml(attributes);
			rendered.push(`<${token.tag}${attrs ? ` ${attrs}` : ""}>${children}</${token.tag}>`);
			continue;
		}

		if (token.children?.length) {
			rendered.push(await renderTokens(token.children, thumbnails));
		} else if (token.type === "softbreak") {
			rendered.push("<br></br>");
		} else if (token.type === "fence") {
			rendered.push(`<xmp>${token.content}</xmp>`);
		} else if (token.content?.startsWith(">")) {
			rendered.push(`<blockquote>${token.content.slice(1)}</blockquote>`);
		} else if (token.content) {
			rendered.push(token.content);
		}
	}
	return rendered.join("");
}

export async function renderMarkdown(content, thumbnails) {
	try {
		const tokens = markdown.parse(content ?? "", { html: true });
		return await renderTokens(tokens, thumbnails);
	} catch {
		return content ?? "";
	}
}

export const renderChannelLink = (channel) => `<a target="_blank" href="./${channel.slug}"><p class="channel"><span>${channel.title ?? channel.slug}</span></p></a>`;
export { image, thumb };

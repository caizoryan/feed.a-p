import { auth } from "./auth.js";

// let host =  "http://localhost:3001/api"
let host =  "https://api.are.na/v3"
const apiHost = (process.env.ARENA_API_URL ??host).replace(/\/$/, "");
const requestOptions = {
	headers: {
		Authorization: `Bearer ${auth}`,
		cache: "no-store",
		"Cache-Control": "max-age=0, no-cache",
		referrerPolicy: "no-referrer",
	},
};

async function fetchJson(url) {
	console.log(`→ are.na GET ${url}`);
	const response = await fetch(url, requestOptions);
	if (!response.ok) {
		console.log(`✗ are.na ${response.status} ${response.statusText} ${url}`);
		throw new Error(`Are.na request failed (${response.status} ${response.statusText}): ${url}`);
	}
	return response.json();
}

// In-memory cache for Are.na blocks, keyed by block id. getBlock() checks this
// before making an API call, and channel contents pre-populate it so blocks
// already present in a channel cost no requests.
const blockStore = new Map();
const pendingBlocks = new Map();

const blockKey = (id) => String(id);

export function getCachedBlock(id) {
	return blockStore.get(blockKey(id));
}

export function cacheBlock(block) {
	if (block?.id != null) blockStore.set(blockKey(block.id), block);
}

export function cacheBlocks(list) {
	if (!Array.isArray(list)) return;
	for (const item of list) {
		// v3 has returned both raw blocks and connection-wrapped items;
		// cache whichever shape carries the block.
		cacheBlock(item?.block ?? item);
	}
}

async function resolveBlock(id, fetchBlock) {
	const cached = getCachedBlock(id);
	if (cached) return cached;

	const cacheKey = blockKey(id);
	if (pendingBlocks.has(cacheKey)) return pendingBlocks.get(cacheKey);

	const request = fetchBlock(id)
		.then((block) => {
			cacheBlock(block);
			return block;
		})
		.finally(() => pendingBlocks.delete(cacheKey));

	pendingBlocks.set(cacheKey, request);
	return request;
}

export async function getChannelInfo(slug) {
	return fetchJson(`${apiHost}/channels/${encodeURIComponent(slug)}`);
}

export async function getChannelContents(slug) {
	let page = 1;
	let contents = [];
	let meta;

	do {
		const response = await fetchJson(
			`${apiHost}/channels/${encodeURIComponent(slug)}/contents?page=${page}&per=100`,
		);
		contents = contents.concat(response.data ?? []);
		meta = response.meta;
		const pageBlocks = response.data ?? [];
		cacheBlocks(pageBlocks);
		console.log(`· cached ${pageBlocks.length} blocks from ${slug} (page ${page})`);
		page = meta?.next_page;
	} while (meta?.has_more_pages && page);

	return contents.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function getChannel(slug) {
	const channel = await getChannelInfo(slug);
	channel.contents = await getChannelContents(slug);
	return channel;
}

export async function getBlock(id) {
	return resolveBlock(id, (blockId) => fetchJson(`${apiHost}/blocks/${encodeURIComponent(blockId)}`));
}

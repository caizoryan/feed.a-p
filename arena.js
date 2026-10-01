import { auth } from "./auth.js";

const apiHost = (process.env.ARENA_API_URL ?? "http://localhost:3001/api").replace(/\/$/, "");
const requestOptions = {
	headers: {
		Authorization: `Bearer ${auth}`,
		cache: "no-store",
		"Cache-Control": "max-age=0, no-cache",
		referrerPolicy: "no-referrer",
	},
};

async function fetchJson(url) {
	const response = await fetch(url, requestOptions);
	if (!response.ok) {
		throw new Error(`Are.na request failed (${response.status} ${response.statusText}): ${url}`);
	}
	return response.json();
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
			`${apiHost}/channels/${encodeURIComponent(slug)}/contents?page=${page}&per=100&force=true`,
		);
		contents = contents.concat(response.data ?? []);
		meta = response.meta;
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
	return fetchJson(`${apiHost}/blocks/${encodeURIComponent(id)}`);
}

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { getChannelContents, getChannelInfo } from "./arena.js";
import { renderChannel, wrapPage } from "./page.js";
import { createRssItems, renderRss } from "./rss.js";
import { readJson, sortByPosition, writeFile, writeJson } from "./utils.js";

const root = process.cwd();
const dist = path.join(root, "dist");
const stateFile = path.join(root, "last_state.json");
const MAIN_CHANNEL = process.env.MAIN_CHANNEL ?? "feed-2026";
const loadedState = readJson(stateFile, {});
const state = loadedState && typeof loadedState === "object" && !Array.isArray(loadedState) ? loadedState : {};
state.channels = Array.isArray(state.channels) ? state.channels : [];
state.blocks = Array.isArray(state.blocks) ? state.blocks : [];
state.mainChannelSlug ??= MAIN_CHANNEL;

function cachedChannel(slug) {
	return state.channels.find((channel) => channel.slug === slug);
}

function saveChannel(channel) {
	const index = state.channels.findIndex((item) => item.slug === channel.slug);
	if (index < 0) state.channels.push(channel);
	else state.channels[index] = channel;
}

function isUpdated(current, previous) {
	if (!previous?.updated_at || !current?.updated_at) return true;
	const currentTime = Date.parse(current.updated_at);
	const previousTime = Date.parse(previous.updated_at);
	return Number.isNaN(currentTime) || Number.isNaN(previousTime) || currentTime > previousTime;
}

async function loadChannel(slug, { forceContents = false } = {}) {
	const info = await getChannelInfo(slug);
	const previous = cachedChannel(info.slug ?? slug);
	let contents;
	if (!forceContents && previous && !isUpdated(info, previous) && Array.isArray(previous.contents)) {
		console.log(`Using cached contents for ${info.slug ?? slug}`);
		contents = previous.contents;
	} else {
		console.log(`Fetching contents for ${info.slug ?? slug}`);
		contents = await getChannelContents(slug);
	}
	const channel = { ...previous, ...info, slug: info.slug ?? slug, contents };
	saveChannel(channel);
	return channel;
}

function updateBlockState(channels) {
	state.blocks = channels.flatMap((channel) => (channel.contents ?? []).map((block) => ({
		id: block.id,
		type: block.type,
		updated_at: block.updated_at,
		channelSlug: channel.slug,
	})));
}

function pageLinks(channels) {
	const projects = channels.map((channel) =>
		`<p><a href="./${channel.slug}.html">${(channel.title ?? channel.slug).replace("[FEED] ", "")}</a></p>`,
	).join("");
	return `<a href="./feed.xml"><h4>RSS</h4></a><br></br><h4>Pages</h4>${projects}`;
}

function copyStylesheet() {
	fs.copyFileSync(path.join(root, "style.css"), path.join(dist, "style.css"));
}

function writeBlockPages(blockPages) {
	for (const blockPage of blockPages) {
		writeFile(path.join(dist, "blocks", `${blockPage.id}.html`), blockPage.html);
	}
}

function writeChannelPage(channel, links = "", isIndex = false) {
	return renderChannel(channel).then(({ html, blockPages }) => {
		writeBlockPages(blockPages);
		const filename = isIndex ? "index.html" : `${channel.slug}.html`;
		writeFile(path.join(dist, filename), wrapPage(html, { links, isIndex }));
		return { html, blockPages };
	});
}

async function chooseChannel(query) {
	const channels = state.channels;
	if (!channels.length) throw new Error("No saved channels found in last_state.json. Run the full build first.");

	if (query) {
		const match = channels.find((channel) => channel.slug === query)
			?? channels.find((channel) => channel.title?.toLowerCase().includes(query.toLowerCase()) || channel.slug.toLowerCase().includes(query.toLowerCase()));
		if (!match) throw new Error(`No saved channel matches "${query}".`);
		return match;
	}

	const rl = readline.createInterface({ input, output });
	try {
		console.log("Pick a channel to generate:");
		channels.forEach((channel, index) => console.log(`${index + 1}. ${channel.title ?? channel.slug} (${channel.slug})`));
		const answer = await rl.question("Channel number: ");
		const selection = Number.parseInt(answer, 10) - 1;
		if (!Number.isInteger(selection) || selection < 0 || selection >= channels.length) {
			throw new Error("Invalid channel selection.");
		}
		return channels[selection];
	} finally {
		rl.close();
	}
}

function parseChannelArg(args) {
	const index = args.findIndex((arg) => arg === "-c" || arg === "--channel");
	if (index < 0) return { requested: false };
	const next = args[index + 1];
	return { requested: true, query: next && !next.startsWith("-") ? next : undefined };
}

async function runSingleChannel(query) {
	const selected = await chooseChannel(query);
	console.log(`Generating only ${selected.slug}`);
	const channel = await loadChannel(selected.slug, { forceContents: true });
	updateBlockState([channel]);
	await writeChannelPage(channel, pageLinks(state.channels));
	copyStylesheet();
}

async function runFullBuild() {
	console.log(`Getting main channel: ${MAIN_CHANNEL}`);
	const mainChannel = await loadChannel(MAIN_CHANNEL, { forceContents: true });
	const linkedChannels = sortByPosition((mainChannel.contents ?? []).filter((block) => block.type === "Channel"));
	const channels = [];

	for (const linked of linkedChannels) {
		const channel = await loadChannel(linked.slug);
		console.log(`Ready: ${channel.slug}`);
		channels.push(channel);
	}

	state.mainChannelSlug = MAIN_CHANNEL;
	updateBlockState([mainChannel, ...channels]);
	const links = pageLinks(channels);
	await writeChannelPage(mainChannel, links, true);

	for (const channel of channels) {
		console.log(`Creating HTML file for: ${channel.slug}`);
		await writeChannelPage(channel, links);
	}

	const rssItems = await createRssItems(mainChannel.contents);
	writeFile(path.join(dist, "feed.xml"), renderRss(rssItems));
	copyStylesheet();
}

async function main() {
	try {
		const channelArg = parseChannelArg(process.argv.slice(2));
		if (channelArg.requested) await runSingleChannel(channelArg.query);
		else await runFullBuild();
		state.lastRunAt = new Date().toISOString();
		state.lastError = null;
	} catch (error) {
		state.lastError = { message: error.message, at: new Date().toISOString() };
		console.error(error);
		process.exitCode = 1;
	} finally {
		state.lastAttemptAt = new Date().toISOString();
		try {
			writeJson(stateFile, state);
		} catch (error) {
			console.error(`Could not save state to ${stateFile}:`, error);
			process.exitCode = 1;
		}
	}
}

await main();

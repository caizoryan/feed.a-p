import fs from "node:fs";
import path from "node:path";
import { parseHTML } from "linkedom";

export const MONTHS = [
	"January", "February", "March", "April", "May", "June",
	"July", "August", "September", "October", "November", "December",
];

export function ensureDir(directory) {
	fs.mkdirSync(directory, { recursive: true });
}

export function writeFile(filePath, contents) {
	ensureDir(path.dirname(filePath));
	fs.writeFileSync(filePath, contents);
}

export function readJson(filePath, fallback) {
	try {
		return JSON.parse(fs.readFileSync(filePath, "utf8"));
	} catch (error) {
		if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
		return fallback;
	}
}

export function writeJson(filePath, value) {
	writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function sortByPosition(blocks) {
	return [...blocks].sort(
		(a, b) => (a.connection?.position ?? a.position ?? 0) - (b.connection?.position ?? b.position ?? 0),
	);
}

function padZero(value) {
	return String(value).padStart(2, "0");
}

export function formatTime(date) {
	const week = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	return `${date.getDate()} ${MONTHS[date.getMonth()]}, ${week[date.getDay()]}, ${padZero(date.getHours())}:${padZero(date.getMinutes())}`;
}

export function formatDate(date) {
	return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function monthName(date) {
	return MONTHS[date.getMonth()];
}

export function stripHtml(html) {
	const { document } = parseHTML("<!doctype html><html><body></body></html>");
	const container = document.createElement("div");
	container.innerHTML = String(html);
	return (container.innerText ?? container.textContent ?? "").trim();
}

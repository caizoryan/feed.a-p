import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { parseHTML } from "linkedom";
import { wrapPage } from "./page.js";

const script = readFileSync(new URL("../public/script.js", import.meta.url), "utf8");

function setup() {
	const { window, document } = parseHTML(wrapPage("<p>Feed</p>"));
	vm.runInNewContext(script, {
		document,
	});
	return { window, document };
}

test("pages include a mobile viewport and an accessible, collapsed menu toggle", () => {
	const { document } = setup();
	assert.equal(document.querySelector('meta[name="viewport"]').content, "width=device-width, initial-scale=1");
	const toggle = document.querySelector(".menu-toggle");
	assert.equal(toggle.getAttribute("aria-expanded"), "false");
	assert.ok(document.getElementById(toggle.getAttribute("aria-controls")));
	assert.equal(toggle.textContent.trim(), "feed.a-p.space");
	assert.ok(document.querySelector(".site-header .menu-chevron"));
	assert.ok(document.querySelector("#sidebar").hasAttribute("inert"));
});

test("hamburger toggles the sidebar and Escape closes it", () => {
	const { window, document } = setup();
	const toggle = document.querySelector(".menu-toggle");
	const sidebar = document.querySelector(".panel");
	toggle.click();
	assert.equal(toggle.getAttribute("aria-expanded"), "true");
	assert.ok(sidebar.classList.contains("is-open"));
	assert.ok(document.querySelector(".site-header").classList.contains("is-open"));
	assert.equal(sidebar.inert, false);
	toggle.click();
	assert.equal(toggle.getAttribute("aria-expanded"), "false");
	assert.ok(!sidebar.classList.contains("is-open"));

	toggle.click();
	const escape = new window.Event("keydown");
	escape.key = "Escape";
	document.dispatchEvent(escape);
	assert.equal(toggle.getAttribute("aria-expanded"), "false");
	assert.ok(!sidebar.classList.contains("is-open"));
});

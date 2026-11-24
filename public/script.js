(() => {
	const menuToggle = document.querySelector(".menu-toggle");
	const sidebar = document.querySelector("#sidebar");

	if (menuToggle && sidebar) {
		const setMenuOpen = (open) => {
			sidebar.classList.toggle("is-open", open);
			menuToggle.closest(".site-header")?.classList.toggle("is-open", open);
			sidebar.inert = !open;
			menuToggle.setAttribute("aria-expanded", String(open));
		};

		menuToggle.addEventListener("click", () => {
			setMenuOpen(menuToggle.getAttribute("aria-expanded") !== "true");
		});

		document.addEventListener("keydown", (event) => {
			if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
				setMenuOpen(false);
				menuToggle.focus();
			}
		});
	}

	const container = document.querySelector(".container");
	if (!container) return;

	const keys = { width: "feed:a-p:width", view: "feed:a-p:view" };

	const read = (key) => {
		try {
			return localStorage.getItem(key);
		} catch {
			return null;
		}
	};

	const write = (key, value) => {
		try {
			localStorage.setItem(key, value);
		} catch {
			// Storage may be unavailable (private mode, disabled cookies).
		}
	};

	const widthButtons = Array.from(document.querySelectorAll(".view-options [data-width]"));
	const viewButtons = Array.from(document.querySelectorAll(".view-options [data-view]"));

	function render() {
		const { width, view } = container.dataset;
		container.style.setProperty("--block-width", `${width}px`);
		document.documentElement.style.setProperty("--block-width", `${width}px`);
		for (const button of widthButtons) {
			const active = button.dataset.width === width;
			button.classList.toggle("active", active);
			button.setAttribute("aria-pressed", String(active));
		}
		for (const button of viewButtons) {
			const active = button.dataset.view === view;
			button.classList.toggle("active", active);
			button.setAttribute("aria-pressed", String(active));
		}
	}

	const storedWidth = read(keys.width);
	if (storedWidth) container.dataset.width = storedWidth;
	const storedView = read(keys.view);
	if (storedView) container.dataset.view = storedView;

	render();

	for (const button of widthButtons) {
		button.addEventListener("click", () => {
			container.dataset.width = button.dataset.width;
			write(keys.width, button.dataset.width);
			render();
		});
	}

	for (const button of viewButtons) {
		button.addEventListener("click", () => {
			container.dataset.view = button.dataset.view;
			write(keys.view, button.dataset.view);
			render();
		});
	}
})();

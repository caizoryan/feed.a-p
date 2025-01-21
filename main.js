import fs from "fs"
import { auth } from "./auth.js"

// get channel
let channel = await fetch("https://api.are.na/v2/channels/blog-feed",
	{
		headers: {
			Authorization: `Bearer ${auth}`,
			cache: "no-store",
			"Cache-Control": "max-age=0, no-cache",
			referrerPolicy: "no-referrer",
		},

	}
)
	.then((res) => res.json())

console.log(channel)

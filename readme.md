# Welcome to feed.a-p.space backrooms

Welcome to anyone browsing this. This is a space for me to play around with static site generation while also making something to host a log of me making things. I wanted a space where I can document things I'm making, sketches, prototypes, ideas, seed of future projects.

I would also like to point you to [Grant Custer's space](https://feed.grantcuster.com/) that I was very much inspired by. This is an aim to create a similar kind of space.


## How this repo works

1. Content is edited on Are.na.
2. `main.js` coordinates fetching, caching, page generation, and RSS output. Rendering and API utilities live in separate modules.
3. Generated site files are written to `dist/` for deployment.

Run a full build with `npm run build`. The first build fetches all linked channels; later builds reuse a channel's cached contents unless its Are.na `updated_at` value has changed. The cache is stored in the ignored `last_state.json` file and is saved after successful or failed runs.

To regenerate just one saved channel, run `npm run build -- --channel` and choose from the interactive list, or pass a saved slug/title query with `npm run build -- --channel <channel>`. This writes that channel's HTML and block pages without rebuilding the index or RSS feed.

The API defaults to `http://localhost:3001/api`, matching the local proxy setup. Set `ARENA_API_URL` to use another API endpoint; set `MAIN_CHANNEL` to override the default `feed-2026` channel.

## Outline

#### State / Data
This website runs on [Are.na](https://are.na). The specific channel that populates the content is private. This is for a few reasons.
1. To not send out notifications everytime I add something to the channel
2. I can have unpublished draft blocks by just controlling which blocks get rendered.
3. Only text blocks get published, if I want to show images/videos/pdf/link on the webpage, they have to be markdown linked in a text block.

#### Generation modules
- `main.js` manages the build lifecycle, state, CLI selection, and progress/error logging.
- `arena.js` handles Are.na API requests.
- `components.js` transforms Markdown and Are.na block links into components.
- `page.js` renders channel HTML pages.
- `rss.js` creates the RSS feed.
- `utils.js` contains shared file, date, and sorting helpers.

#### style.css
Right now the style lives in here, maybe in the future will also move this in the ssg renderer

#### Generated site
HTML pages, block pages, `feed.xml`, and a copy of `style.css` are generated into `dist/`. The source `index.html` remains separate from generated output.

#### auth.js && .gitignore
If you look into main.js there is an import for auth.js but it doesn't appear on the repository. This is because it's ignored by git by marking it to be ignored in the .gitignore file. This file contains credentials/passphrase/token whatever you wanna call it to access my private channels on are.na. You can get your own from this [token generator](https://arena-token-gen.vercel.app/). Once you do that and you're interested in using this template, you can set it up by creating a auth.js file and exporting token from there as such: 

```js
export const auth = 'your auth token here'
```

## Next steps

#### Multiple Channels
I wanna think of linking to other channels, this again I would restrict by only linking through text blocks. If a channel is linked in a text block, the process in main.js will also create another html file for that specific channel. And onclick I can have a draggable iframe open up for the channel, but since it's a file it can also be accessed through the link (this is a cool feature coming from single page application world lmao, but is the most basic thing)

#### Download Images/videos
This I'll have to think and consider, because this will also mean I have to manage state for which images/videos have been already downloaded so I don't re-download each time. But should be a pretty simple one.

#### iframes
iframes are a fun tool, I'm thinking of using them in [this](https://wmianecki.github.io/thesis_website) sort of way. Maybe, maybe not but seems like a cool idea.


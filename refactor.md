# Refactoring

Currently, main.js is the entry point and everything happens here.

I want to break this up so that there are other files:

### components.js 
This will keep all the component transformations.

### page.js
This will turn a channel into an html page.

### arena.js
Are.na related utilities

### utils.js
any basic utilities

### rss.js
will take blocks and turn them into rss data

### main.js 
will still be the entrypoint and manage the lifecycle and console log updates.
It will also hold a state object that will update as the page generation happens.
It will keep channels that are in the channels (pages) and a list of blocks, etc.
once run is done, or on error, it will save this to last_state.json

it will also accept cli args.
For instance -c or --channel will open a cli picker to pick channel (from the last_state.json) and on select it will fetch only that channel and write that as an html file.

Channels that are pulled in at main.js inside the main channel, check the updated_at and compare to last_state.json, and pull it's contents only if it has been updated after the last run.

pages will now be written to dist/

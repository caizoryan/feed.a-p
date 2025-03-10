import { minimalSetup, EditorView, basicSetup } from "codemirror";
import * as view from "@codemirror/view";
import * as state from "@codemirror/state";
import * as lang_markdown from "@codemirror/lang-markdown";
import * as language from "@codemirror/language";
import * as lezer_higlight from "@lezer/highlight";
import * as lang_javascript from "@codemirror/lang-javascript";
import * as lint from "@codemirror/lint";
import * as commands from "@codemirror/commands"
import * as search from "@codemirror/search"
import * as autocomplete from "@codemirror/autocomplete"

//import { Vim, vim } from "../codemirror-vim/dist/codemirror-vim/src/index.js"

export {
  EditorView,
  state,
  view,
  language,
  commands,
  search,
  autocomplete,
  lint,
  basicSetup,
  minimalSetup,
  lang_markdown,
  lang_javascript,
  lezer_higlight,
  // vim,
  // Vim,
};

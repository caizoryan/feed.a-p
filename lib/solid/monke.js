/* A work in progress handcrafted appropriation of Solid.js
 *
 *  /~\
 * C oo
 *  ( ^)
 *  / ~\
 *
 *  |____
 *  A SOLID MONKE
 *  ____|
 *
 * Tools are personal, language is a tool, code is a language.
 * I like writing my code in very personal, often stupid and
 * esoteric ways. This is something that I have been slowly developing
 * over the past few months. It is not a necesarily a framework or a library
 * but rather an expression of sorts.
 *
 * Feel free to look around, use whatever you might find is useful,
 *
 * This code is licesned under the GPL license.
 * You can read about it more here
 * https://www.gnu.org/licenses/quick-guide-gplv3.html
 *
 */

import {
  batch,
  createEffect,
  createMemo,
  createMutable,
  createSignal,
  createStore,
  For,
  h,
  on,
  onMount,
  produce,
  render,
  Switch,
} from "./mini-solid.js";
import { h as html } from "./concise_html/index.js";

// The core, the heart and the soul

/** Creates a signal object with a getter and setter.
 *
 * @template {any} T
 * @typedef {Object} Signal<T>
 * @property {Function} Signal.set
*/


// Reactivity
/**
 * @template {any} T
 *
 * @param {T} val - The initial value of the signal.
 * @returns {Signal<T>} - An object with `is` property representing the getter and `set` property representing the setter.
 */
const sig = (val) => {
  const [getter, setter] = createSignal(val);
  getter.set = setter;
  return getter;
};

let f = sig("")


// Dependent Reactivity
/**
 * Creates a memoized version of the provided callback function.
 *
 * @param {Function} callback - The callback function to be memoized.
 * @returns {Function} - The memoized value returned by the callback function.
 */
const mem = (callback) => createMemo(callback);

/**
 * Creates an effect by wrapping a callback function.
 *
 * @param {Function} callback - The callback function to be wrapped.
 */
const eff = (callback) => createEffect(callback);
/**
 * Applies an effectful operation on a dependency and invokes a callback.
 *
 * @param {Function} dep - The dependency to apply the effect based on.
 * @param {Function} callback - The callback function to invoke.
 * @returns {void}
 */
const eff_on = (dep, callback) =>
  eff(on(typeof dep === "function" ? dep : () => dep, callback));

// Rendering Control Flow,
// Essentially the for loop —> but for rendering (keyed)
const each = (dep, children) => () =>
  For({ each: typeof dep === "function" ? dep() : dep, children });

// The switch statement for rendering
/**
 * Creates a conditional statement with multiple branches.
 * Each branch consists of a condition and a set of child elements.
 *
 * Can be provided as an array of arrays or an array of objects.
 * eg. [condition, child], or { if: condition, then: child }
 *
 * @param {...(Array|Object)} etc - The branches of the conditional statement.
 * @returns {Object} - The conditional statement object.
 */
const if_then = (...etc) => {
  const kids = etc.map((item) => {
    const [when, children] = Array.isArray(item) ? item : if_then_object(item);
    return () => ({ when, children });
  });

  return Switch({
    fallback: null,
    children: kids,
  });
};

/** Creates a conditional statement with multiple branches.
 *
 * Can be provided as an array of arrays or an array of objects.
 * eg. (condition, [value, child])
 *
 * @param {any, ...(Array)} etc - The branches of the conditional statement.
 * @returns {Object} - The conditional statement object.
 */
const when = (condition, ...etc) => {
  let kids = etc.map((item) => {
    let cond = () =>
      typeof condition === "function"
        ? condition() === item[0]
        : condition === item[0];

    return [cond, item[1]];
  });

  return if_then(...kids);
};

// Helpers for h() essentially just like JSX
// But its just javascript and no black boxes
// This is just a personal take but I quite prefer this
// over JSX... why mix html and javascript syntactically like that?
const div = (...args) => h("div", ...args);
const span = (...args) => h("span", ...args);
const br = (...args) => h("br", ...args);

const p = (...args) => h("p", ...args);
const a = (link, ...args) =>
  h("a", combined({ href: link, target: "_blank" }, ...args), ...args);
const img = (link, ...args) =>
  h("img", combined({ src: link }, ...args), ...args);
const video = (link, ...args) =>
  h(
    "video",
    { controls: true, height: "90%" },
    h("source", { src: link }, ...args),
    ...args,
  );
const button = (...args) => h("button", ...args);

const h1 = (...args) => h("h1", ...args);
const h2 = (...args) => h("h2", ...args);
const h3 = (...args) => h("h3", ...args);
const h4 = (...args) => h("h4", ...args);

// this just cuz jquery is king
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// This is utilities for larger reactive structures
const store = createStore;
const mounted = onMount;
const mut = createMutable;

const inn = (time, callback) => setTimeout(callback, time);
const every = (time, callback) => setInterval(callback, time);

export {
  $,
  $$,
  a,
  batch,
  br,
  button,
  div,
  each,
  eff,
  eff_on,
  every,
  For,
  h,
  h1,
  h2,
  h3,
  h4,
  html,
  if_then,
  img,
  inn,
  mem,
  mounted,
  mut,
  p,
  produce,
  render,
  sig,
  span,
  store,
  video,
  when,
};

const if_then_object = (obj) => {
  let cond = obj.if;
  let child = obj.then;

  return [cond, child];
};

const combined = (obj, ...args) => {
  const arg = args.find((item) => typeof item === "object");
  return args.find((item) => typeof item === "object")
    ? { ...obj, ...arg }
    : obj;
};

// ....................................................
// ....................................................
// ........................./\.........................
// ..................______/__\_______.................
// ..................||-------------||.................
// ..................||             ||.................
// ..................||    \|||/    ||.................
// ..................||   [ @-@ ]   ||.................
// ..................||    ( ' )    ||.......       ...
// ..................||    _(O)_    ||.......|EXIT |...
// ..................||   / >=< \   ||.......|==>> |...
// ..................||__/_|_:_|_\__||.................
// ..................-----------------.................
// ....................................................
// ....................................................
// Monkey with a bowtie in the museum-- >

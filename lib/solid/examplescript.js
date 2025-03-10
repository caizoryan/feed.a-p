import {
  $,
  render,
  sig,
  mem,
  each,
  div,
  if_then,
  when,
  br,
} from "./solid_monke.js";

const variable = sig(["hello"]);
const count = mem(() => variable.is().length);
const mouse_x = sig(0);
const mouse_y = sig(0);

document.addEventListener("mousemove", (event) => {
  mouse_x.set(event.clientX);
  mouse_y.set(event.clientY);
});

const Test = () => {
  return div(
    { onclick: () => variable.set([...variable.is(), "hello"]) },

    "mouse: ", mouse_x.is, " x  ", mouse_y.is, " y  ",
    br(),

    "count is: ", count,
    _ => each(variable.is(), (item, i) => div(item, " ", i())),
    Switcher,

    _ => when(count(), [7, div("its seven now")]),
  );
};

const Switcher = () => {
  return if_then(
    { if: count() === 1, then: div("one") },
    [count() === 2, div("two #3")],
    { if: count() === 3, then: div("three") },
  )

}

render(Test, $("#root"));

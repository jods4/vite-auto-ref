// computed should be auto-imported as it's used by auto.computed in this code
import { createApp, auto as a2, ref } from "vue";

// Untouched code ----------------------------------------

const regular = ref(1); // Plain ref
// Bad code but shouldn't be transformed
regular = 4;

// This isn't the right auto
function g(a2) {
  const x = a2.ref(0);
  return x;
}

// Purposefully don't modify non-local variable calls, as the resulting value wouldn't be tracked
// TODO: warn user
console.log(a2(0));
const obj = { a: a2(0) };

// Refs --------------------------------------------------

let magic = a2.ref(1);

magic = 4;
magic++;
magic -= 2;
magic("call me");

function f() {
  return magic + regular.value;
}

// This is a different magic!
function h() {
  const magic = 3;
  console.log(magic);
}

// Yet another magic, but also auto
function h2() {
  const magic = a2.ref(1);
  ref(magic).value = magic + 1;
}

// Computeds ---------------------------------------------

const comp = a2.computed(() => magic + "");
let writable = a2.computed({ get: () => 1, set: v => {} });

writable = comp.indexOf("needle");

// Custom ------------------------------------------------

const custom = a2(ref(1));
const anything = a2(g(magic));

custom = anything + 3;
anything -= g(custom);

// Grabbing the real ref ---------------------------------

console.dir(ref(magic), ref(comp), ref(custom));

function m() {
  let ref = x => x + 2;
  let z = ref(magic);  // Shadows Vue ref
}

// Non-variable cases ------------------------------------

regular.magic({
  magic: 42
});

class A { magic() {} }
// Not supported by esprima yet
// class B { magic = 3 }

// More test cases (they just work, though) --------------

obj = {
  // Computed
  [magic]: 1, 
  // Shorthand
  magic,
}
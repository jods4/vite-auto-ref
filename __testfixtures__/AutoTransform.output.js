// computed should be auto-imported as it's used by auto.computed in this code
import { auto } from "thats-not-it";
import { createApp, ref, computed } from "vue";

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

let magic = ref(1);

magic.value = 4;
magic.value++;
magic.value -= 2;
magic.value("call me");

function f() {
  return magic.value + regular.value;
}

// This is a different magic!
function h() {
  const magic = 3;
  console.log(magic);
}

// Yet another magic, but also auto
function h2() {
  const magic = ref(1);
  magic.value = magic.value + 1;
}

// Computeds ---------------------------------------------

const comp = computed(() => magic.value + "");
let writable = computed({ get: () => 1, set: v => {} });

writable.value = comp.value.indexOf("needle");

// Custom ------------------------------------------------

const custom = ref(1);
const anything = g(magic.value);

custom.value = anything.value + 3;
anything.value -= g(custom.value);

// Grabbing the real ref ---------------------------------

console.dir(magic, comp, custom);

function m() {
  let ref = x => x + 2;
  let z = ref(magic.value);  // Shadows Vue ref
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
  [magic.value]: 1, 
  // Shorthand
  magic: magic.value,
}

// Temporal dead zone
function later() { 
  console.log(tdz.value);
}
let tdz = 1;

// Bug when used directly in VariableDeclarator
let varDecl = tdz.value;

// Special case: setup() returning object literal --------

const Comp = { 
  setup() {
    let a = ref(1), b = ref(2), c = a.value + b.value;
    function setup() {
      return { a: a.value };
    }
    let f = function () {
      return { a: a.value };
    }
    let lambda = () => { return { a: a.value }; };
    return {
      a,
      aa: b,
      c,
      d: a.value + b.value
    };
  }
}
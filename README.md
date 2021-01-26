# Vite-Auto-Ref
This is a prototype / experimental / proof-of-concept Vite plugin that allows you to manipulate Vue 3 `ref` without `.value`.

_This plugin is not production-ready! It's meant to gather feedback on vuejs/rfcs#223, use at your own risk. May contain bugs, API may change._

## Requirements
Currently this plugin only works in **Node 14.3+**.

It only works if it's imported as a true ESM module in your Vite config, which means you **must** use `vite.config.mjs`.


## Get started
Install this package: `npm i vite-auto-ref --save-dev`.

Add it as a Vite plugin after Vue itself. In your `vite.config.mjs`:
```js
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import autoRef from 'vite-auto-ref';

export default defineConfig({
  plugins: [
    vue(),
    autoRef(),
  ],
});
```

Now in any .js, .ts or .vue file, you can import `vite-auto-ref` and enjoy the magic.

## How to use
In your code, `import { auto } from "vite-auto-ref"`. Feel free to rename the import if you want, e.g. `import { auto as $ } from "vite-auto-ref"`.

> You **must** import `auto`. It won't work with a star-import such as `import * as AR from "vite-auto-ref"`. Not that there's any reason you'd want to do that.

### Creating and manipulating ref values

Three functions are at your disposal:
- `auto.ref()`, which creates a ref like... well, `ref()`.
- `auto.computed()`, which... yeah like `computed()`.
- `auto(x)` which you can use around any `x: Ref<T>` you may have from a function call, `customRef`, etc.

These three functions are **only** usable when initializing a new variable declaration. Here's a valid example:
```js
import { auto } from "vite-auto-ref";

let name = auto.ref("jods");
console.log("Hello " + name);
```

Notice that the declared variable will be reactive, just like a `ref` would, but is actually used like a plain variable without `.value`.

The package comes with TS typings.

Here's a computed example:
```ts
import { auto } from "vite-auto-ref";

let name = auto.ref("jods");
// Notice how name is used
let length = auto.computed(() => name.length);
// length is a computed behind the scene, it can be watched
watchEffect(() => {  
  if (length > 4) // No .value
    console.log("Hello!");
});
// Modification doesn't use .value either
name = "World";
// (Prints "Hello!")
```

### Accessing the ref
Sometimes, you want to access the `ref` itself, instead of its value.

For example, if we'd wanted to use `watch` instead of `watchEffect` we may have tried this code, but it doesn't work:
```js
// Does NOT work!
let length = auto.computed(...);
watch(length, () => console.log("Hello!"));
```
When you use `auto`, you don't think of your variables as refs anymore, but as plain values. This example doesn't work because `watch` expects a `ref` as a first parameter, but the code above is passing just `4`, the value of our computed at that point.

To access the underlying `ref`, just wrap the variable in a normal Vue `ref`:
```js
import { auto } from "vite-auto-ref";
import { ref } from "vue";

// Works
let length = auto.computed(...);
watch(ref(length), () => ...);
```

If you have to manipulate both a ref and its value a lot, you can mix and match as much as you want.
```js
// OK
const xRef = ref(4);
const xVal = auto(xRef);

// Use xRef, xVal as much as you want they point to the same underlying object

// The reverse works OK as well
const yVal = auto.ref(4);
const yRef = ref(yVal);

// You can call ref on an auto variable several times
const yRef2 = ref(yVal);

assert(yRef2 === yRef);
```

### Limits
Be mindful that the magic is tied to a specific variable in a specific scope.

If you copy the variable to another one, pass it to a function, or return it, you will be left with a plain non-reactive copy of its value. Just like when you read a property from a `reactive` object.

If you used `ref` then you will be left with a regular Ref that needs `.value` to be accessed. No more magic after that.

A few example
```ts
let x = auto.ref(1), y = auto.ref(2);
let sum = x + y; // This is just the number 3, use a computed if you want a reactive sum
let x2 = x; // This is just the number 1, it is not a ref, and unrelated to x.

function greet(str: Ref<T>) {
  // You can make a parameter auto if it's a Ref **only** (be sure to check)
  let s = auto(str);
  s = "Hello " + s; // ok, puts a new value into the ref
  return s; // greet returns a plain string, not a computed nor a ref!
}

function greet2(str: Ref<T>) {
  let s = auto.computed(() => "Hello " + str.value);
  return s; // still returning a string!!
}

function useGreet(str: Ref<T>) {
  let s = auto.computed(() => "Hello " + str.value);
  return ref(s); // useGreet returns the computed
}
```

A special exception is made when returning an object literal from a function property named `setup`.
In this case the `ref` is returned even if you don't explicitely ask for it, as it's the right thing to do 99% of the time.
```js
// Works the way you want it to:
export default {
  setup() {
    let name = auto.ref("");
    return { name } // Actually a ref, `setup()` is an exception
  }
}
```

## Future ideas
If the pipe operator is added to JS, it would be a nice way to make values returned by functions auto. Not supported by this plugin yet.
```js
let name = "" |> auto.ref
// alternatively
let name = ref("") |> auto
let len = useLength(name) |> auto
```
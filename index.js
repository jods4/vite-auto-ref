import { init, parse as parseImports } from "es-module-lexer/dist/lexer.js";
import { parse, print } from "recast";
import transform from "./AutoTransform.js";
import * as parser from "./parser.js";

await init;

export default function AutoRefPlugin() {
  return {
    name: 'auto-ref',
    
    transform(src, id) {
      // Never look at node_modules
      if (/\bnode_modules\b/i.test(id)) return;
      // Only process source code
      if (!/\.(ts|js|vue)$/i.test(id)) return;

      // Detect if there is an `import { auto } from 'vite-auto-ref'` at all in the source
      // and quickly bails out if there is none.
      // es-module-lexer is much faster at this task than doing a full AST parse.
      const [imports] = parseImports(src);
      if (!imports.some(x => x.d === -1 // static import
                          && x.e - x.s === 13
                          && src.substring(x.s, x.e) === "vite-auto-ref" 
                          // Useful if checking `import { auto } from "vue"` not so much with vite-auto-ref...
                          /* && /\bauto\b/.test(src.substring(x.ss, x.se))*/))
        return;

      return print(transform(parse(src, { parser })));
    }
  }
}
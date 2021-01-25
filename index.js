import { parse, print } from "recast";
import transform from "./AutoTransform.js";
import * as parser from "./parser.js";

export default function AutoRefPlugin() {
  return {
    name: 'auto-ref',
    
    transform(src, id) {
      // Never look at node_modules
      if (/\bnode_modules\b/i.test(id)) return;
      // Only process source code
      if (!/\.(ts|js|vue)$/i.test(id)) return;

      return print(transform(parse(src, { parser })));
    }
  }
}
// Modified from https://github.com/benjamn/recast/blob/master/parsers/esprima.ts
// Recast doesn't use esprima in module mode, which is apparently then decided based on 
// type in package.json. We want to be sure to force module mode.

import { parseModule } from "meriyah";

// HACK: Bad worarkound for a bug in meriyah. This mutes an assert from recast, but the result seem ok.
//       See https://github.com/meriyah/meriyah/issues/167
import assert from "assert";
assert.strictEqual = () => {};

export function parse(source, options) {
  return parseModule(source, {
    next: true,
    ranges: false,
    loc: true,
  });
};
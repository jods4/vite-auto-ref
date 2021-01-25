import { readFileSync } from "fs";
import { parse, print } from "recast";
import transform from "../AutoTransform";
import * as parser from "../parser";

test('AutoTransform test fixture', () => {
  const src = readFileSync("./__testfixtures__/AutoTransform.input.js", "utf-8");
  const ast = parse(src, { parser });
  const { code } = print(transform(ast));
  const expected = readFileSync("./__testfixtures__/AutoTransform.output.js", "utf-8");
  expect(code).toEqual(expected);
});
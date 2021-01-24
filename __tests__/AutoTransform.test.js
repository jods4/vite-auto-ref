import { readFileSync } from "fs";
import { parse, print } from "recast";
import transform from "../AutoTransform";

test('AutoTransform test fixture', () => {
  const src = readFileSync("./__testfixtures__/AutoTransform.input.js", "utf-8");
  const ast = parse(src);
  const { code } = print(transform(ast));
  const expected = readFileSync("./__testfixtures__/AutoTransform.output.js", "utf-8");
  expect(code).toEqual(expected);
});
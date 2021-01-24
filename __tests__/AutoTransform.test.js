const { readFileSync } = require("fs");
const { transformSrc } = require("../index");

test('AutoTransform test fixture', () => {
  const src = readFileSync("./__testfixtures__/AutoTransform.input.js", "utf-8");
  const { code } = transformSrc(src);
  const expected = readFileSync("./__testfixtures__/AutoTransform.output.js", "utf-8");
  expect(code).toEqual(expected);
});
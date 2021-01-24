const { parse, print } = require("recast");
const transformAst = require("./AutoTransform");

function transformSrc(src) {
  const ast = parse(src, {
    tolerant: true,
  });

  transformAst(ast);

  return print(ast);
}

module.exports = { transformAst, transformSrc };
import { parse as babel } from "@babel/parser";

export function parse(source) {
  return babel(source, {
    sourceType: "module",
    plugins: [ "estree", "topLevelAwait" ],
    tokens: true,
  });
}
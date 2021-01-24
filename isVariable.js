// This function filters out Identifier nodes that aren't actually variable
// Copied from https://github.com/facebook/jscodeshift/blob/master/src/collections/VariableDeclarator.js#L86

import { types } from "recast";

const {
  ClassProperty,
  JSXAttribute,
  MethodDefinition,
  MemberExpression,
  Property
} = types.namedTypes;

export function isVariable(path) {
  const parent = path.parent.node;

  // obj.name
  if (MemberExpression.check(parent) &&
      parent.property === path.node &&
      !parent.computed)
    return false;

  // { name: 3 }
  if (Property.check(parent) && 
      parent.key === path.node &&
      !parent.computed)
    return false;

  // class A { oldName() {} }
  if (MethodDefinition.check(parent) &&
      parent.key === path.node &&
      !parent.computed) 
    return false;

  // class A { oldName = 3 }
  if (ClassProperty.check(parent) &&
      parent.key === path.node &&
      !parent.computed)
    return false;

  // <Foo oldName={oldName} />
  if (JSXAttribute.check(parent) &&
      parent.name === path.node &&
      !parent.computed)
    return false;

  return true;
}
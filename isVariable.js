// This function filters out Identifier nodes that aren't actually variable
// Copied from https://github.com/facebook/jscodeshift/blob/master/src/collections/VariableDeclarator.js#L86
// This is common enough that I wished jscodeshift had a public helper for that

const {
  ClassProperty,
  JSXAttribute,
  MethodDefinition,
  MemberExpression,
  Property
} = require("recast").types.namedTypes;

module.exports = function isVariable(path) {
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
const isVariable = require("./isVariable.js");
const recast = require("recast");
const { 
  Identifier, 
  ImportDeclaration,
  CallExpression, 
  Literal,
  MemberExpression, 
  VariableDeclarator 
} = recast.types.namedTypes;

function isIdent(node, name) {
  return Identifier.check(node) && node.name === name;
}

module.exports = function(file, { jscodeshift: j }) {
  const source = j(file.source);
  
  // 1. Look for import { auto } from "vue"
  
  let auto, ref, globalScope, vueImport

  const hasAuto = source
    .find(ImportDeclaration)
    .some(({ node, scope }) => {
      if (Literal.check(node.source) && node.source.value === "vue") {
        // NOTE: Only a single auto import is supported.
        //       Doing `import { auto, auto as a2 } from "vue"` will result in only `auto`
        //       being supported in this module (first wins).
        let specifier = node.specifiers.find(x => isIdent(x.imported, "auto"));
        if (specifier) {
          auto = specifier.local.name;
          globalScope = scope;
          vueImport = node;

          // Additionally look for ref
          specifier = node.specifiers.find(x => isIdent(x.imported, "ref"));
          if (specifier) ref = specifier.local.name;

          return true;  // Useful for the if, but also short-circuits the iteration
        }
      }
    });

  if (!hasAuto)
    return file.source;

  function isShadowed(name, scope, declaring = globalScope) {
    while (scope && scope !== declaring) {
      if (scope.declares(name)) return true;
      scope = scope.parent;
    }
    return false;
  }

  const isAuto = (node, scope) => isIdent(node, auto) && !isShadowed(auto, scope);    

  const isRef = ref 
    ? (node, scope) => isIdent(node, ref) && !isShadowed(ref, scope)
    : () => false;

  // 2. Replace auto[.ref|.computed]() calls

  const imports = Object.create(null);
  const variables = new Map();

  function registerVariable({ node, scope }) {
    // FIXME: warn if not called as a variable initialization,
    //        or with an object or array pattern.
    if (!VariableDeclarator.check(node) ||
        !Identifier.check(node.id)) 
      return false;

    const scopes = variables.get(node.id.name);
    if (scopes)
      scopes.push(scope);
    else
      variables.set(node.id.name, [scope]);

    return true;
  }

  source
    .find(CallExpression)
    .forEach(path => {
      const { parent, node: { callee, arguments: args }, scope } = path;
            
      // auto(x) -> x      
      if (isAuto(callee, scope)) {
        if (!registerVariable(parent)) return;        
        // FIXME: warn if not called with exactly 1 arg
        if (args.length !== 1) return;
        path.replace(args[0])
        return;
      }

      // auto.ref(x) -> ref(x)
      // auto.computed(...x) -> computed(...x)
      if (MemberExpression.check(callee) && isAuto(callee.object, scope)) {
        if (isIdent(callee.property, "ref") || isIdent(callee.property, "computed")) {
          if (!registerVariable(parent)) return;
          path.node.callee = callee.property;
          imports[callee.property.name] = true;
          return;
        }
      }
    });
    
  // 3. Add missing imports

  for (let i in imports) {
    if (!vueImport.specifiers.some(x => isIdent(x.imported, i)))
      vueImport.specifiers.push(j.importSpecifier(j.identifier(i)));
  }

  // 4. Replace reads from/writes to/ref calls around tracked variables

  const valueIdent = j.identifier("value");

  source
    .find(Identifier)
    .forEach(path => {
      const { node: { name }, scope } = path;
      const scopes = variables.get(name);
      if (!scopes || scopes.every(s => isShadowed(name, scope, s)))
        return;

      if (!isVariable(path)) return;

      // Don't replace variable declaration itself!
      const parentNode = path.parent.node;
      if (VariableDeclarator.check(parentNode)) return;

      // ref(x) -> x
      if (CallExpression.check(parentNode) && 
          isRef(parentNode.callee, scope) && 
          parentNode.arguments.length === 1) {
        path.parent.replace(path.node);
        return;
      }
      
      // x -> x.value
      path.replace(j.memberExpression(path.node, valueIdent));
    });

  return source.toSource();
}
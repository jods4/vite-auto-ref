const isVariable = require("./isVariable");
const { visit, types: { namedTypes, builders: b } } = require("recast");
const { 
  Identifier, 
  CallExpression, 
  Literal,
  MemberExpression, 
  VariableDeclarator 
} = namedTypes;

function isIdent(node, name) {
  return Identifier.check(node) && node.name === name;
}

module.exports = function(ast) {
  // 1. Look for import { auto } from "vue"  

  let auto, ref, globalScope, vueImport;
  visit(ast, {
    visitImportDeclaration(path) {
      const { node, scope } = path;
      if (Literal.check(node.source) && node.source.value === "vue") {
        // NOTE: Only a single auto import is supported.
        //       Doing `import { auto, auto as a2 } from "vue"` will result in only `auto`
        //       being supported in this module (first wins).
        let i = node.specifiers.findIndex(x => isIdent(x.imported, "auto"));
        if (i >= 0) {          
          auto = node.specifiers[i].local.name;
          globalScope = scope;
          vueImport = node;

          // Remove the auto import
          path.get("specifiers", i).prune();

          // Additionally look for `ref`
          ref = node.specifiers.find(x => isIdent(x.imported, "ref"))?.local.name;

          this.abort();
        }
      }

      return false;
    },

    visitStatement() {
      // In case we go past the static imports without finding Vue
      this.abort();
    },
  });

  if (!auto) return;

  function isShadowed(name, scope, declaring = globalScope) {
    // Somehow, recast creates new scope instances for the same node while we visit the AST
    // As I can't compare scope objects directly, I'm comparing their "enclosing" node instead
    const globalNode = declaring.node;
    while (scope && scope.node !== globalNode) {
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

  visit(ast, {
    visitCallExpression(path) {
      this.traverse(path);

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
    }
  });
 
  // 3. Add missing imports

  for (let i in imports) {
    if (!vueImport.specifiers.some(x => isIdent(x.imported, i)))
      vueImport.specifiers.push(b.importSpecifier(b.identifier(i)));
  }

  // 4. Replace reads from, writes to, and ref calls around tracked variables

  const valueIdent = b.identifier("value");

  visit(ast, {
    visitIdentifier(path) {
      const { node: { name }, scope } = path;
      const scopes = variables.get(name);
      if (!scopes || scopes.every(s => isShadowed(name, scope, s)))
        return false;

      if (!isVariable(path)) return false;

      // Don't replace variable declaration itself!
      const parentNode = path.parent.node;
      if (VariableDeclarator.check(parentNode)) return false;

      // ref(x) -> x
      if (CallExpression.check(parentNode) && 
          isRef(parentNode.callee, scope) && 
          parentNode.arguments.length === 1) {
        path.parent.replace(path.node);
        return false;
      }
      
      // x -> x.value
      path.replace(b.memberExpression(path.node, valueIdent));
      return false;
    }
  });  
}
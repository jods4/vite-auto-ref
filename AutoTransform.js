import { isVariable } from "./isVariable.js";
import { visit, types } from "recast";

const b = types.builders;
const { 
  Identifier, 
  CallExpression, 
  Literal,
  MemberExpression, 
  ObjectExpression,
  Property,
  VariableDeclarator 
} = types.namedTypes;

function isIdent(node, name) {
  return Identifier.check(node) && node.name === name;
}

export default function(ast) {
  // 1. Look for import { auto } from "vite-auto-ref", as well as import { ref } from "vue"

  let auto, ref, globalScope, autoRefImport;
  visit(ast, {
    visitImportDeclaration(path) {
      const { node, scope } = path;
      if (node.source.value === "vite-auto-ref") {
        // NOTE: Only a single auto import is supported.
        //       Doing `import { auto, auto as a2 } from "vue"` will result in only `auto`
        //       being supported in this module (first wins).
        let i = node.specifiers.findIndex(x => isIdent(x.imported, "auto"));
        if (i >= 0) {          
          auto = node.specifiers[i].local.name;
          globalScope = scope;
          autoRefImport = path;          
        }
      }
      else if (node.source.value === "vue") {
        ref = node.specifiers.find(x => isIdent(x.imported, "ref"))?.local.name;
      }

      if (auto && ref)
        this.abort();

      return false;
    }
  });

  if (!auto) return ast;

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

  // 2. Find and remove auto[.ref|.computed]() calls

  const imports = new Set();
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
        return args[0];
      }

      // auto.ref(x) -> ref(x)
      // auto.computed(...x) -> computed(...x)
      if (MemberExpression.check(callee) && isAuto(callee.object, scope)) {
        if (isIdent(callee.property, "ref") || isIdent(callee.property, "computed")) {
          if (!registerVariable(parent)) return;
          path.get("callee").replace(callee.property);
          imports.add(callee.property.name);
          return;
        }
      }
    }
  }); 

  // 3. Replace reads from, writes to, and ref calls around tracked variables

  const valueIdent = b.identifier("value");

  const identVisitor = {
    visitIdentifier(path) {
      const { node: { name }, scope } = path;
      const scopes = variables.get(name);
      if (!scopes || scopes.every(s => isShadowed(name, scope, s)))
        return false;

      if (!isVariable(path)) return false;

      // Don't replace variable declaration itself!
      const parentNode = path.parent.node;
      if (path.name === "id" && VariableDeclarator.check(parentNode)) return false;

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
    },

    isSetup(path) {
      return path.name === "value" 
          && Property.check(path.parent.node) 
          && isIdent(path.parent.node.key, "setup");
    },

    visitFunction(path) {
      // We make an exception when visiting a { setup() { } } member
      // and don't transform auto properties in its return statement 
      // if they're directly affected to an object
      this.traverse(path, this.isSetup(path) ? setupVisitor : undefined);      
    },
  };

  const setupVisitor = {
    visitIdentifier: identVisitor.visitIdentifier,
    
    isSetup: identVisitor.isSetup,

    visitFunction(path) {
      this.traverse(path, this.isSetup(path) ? undefined : identVisitor);
    },

    visitReturnStatement(path) {
      // Inside setup(), we never add .value to plain identifiers when
      // returning a plain literal object.
      const returned = path.node.argument;
      if (ObjectExpression.check(returned)) {
        path.get("argument", "properties").each(a => { // `a` is NodePath<Property>
          if (!Identifier.check(a.node.value))
            this.traverse(a);
          // Remove the identifier if it's "auto", it's automatically added by Vue compiler in <script setup>
          if (a.node.value.name === auto && !isShadowed(auto, path.scope))
            a.prune();
        });
        return false;
      }

      this.traverse(path);
    },
  };

  visit(ast, identVisitor);

  // 4. Fix imports: add missing required imports and remove "vite-auto-ref"

  const missing = Array.from(imports.keys()).filter(i => !globalScope.declares(i));
  if (missing.length)
    autoRefImport.replace(
      b.importDeclaration(
        missing.map(m => b.importSpecifier(b.identifier(m))),
        b.literal("vue")
      ));
  else
    autoRefImport.prune();

  return ast; // For chaining convenience
}
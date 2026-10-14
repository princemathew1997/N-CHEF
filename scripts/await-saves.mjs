import { parse } from 'acorn';
import { readFileSync, writeFileSync } from 'node:fs';

// One-time AST transformation: await saves in their actual containing functions.
for (const path of ['js/app.js', 'js/wizard.js']) {
    const source = readFileSync(path, 'utf8');
    const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
    const edits = [], functions = new Set();
    function visit(node, stack = []) {
        if (!node || typeof node !== 'object') return;
        const isFunction = ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type);
        const current = isFunction ? [...stack, node] : stack;
        if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'saveData') {
            if (!stack.length) throw new Error(`Top-level save in ${path}`);
            edits.push({ position: node.start, text: 'await ' });
            const container = stack.at(-1);
            if (!container.async) functions.add(container);
        }
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(child => visit(child, current));
            else if (value && typeof value === 'object') visit(value, current);
        }
    }
    visit(tree);
    for (const fn of functions) edits.push({ position: fn.start, text: 'async ' });
    let result = source;
    for (const edit of edits.sort((a, b) => b.position - a.position)) result = result.slice(0, edit.position) + edit.text + result.slice(edit.position);
    parse(result, { ecmaVersion: 'latest', sourceType: 'script' });
    writeFileSync(path, result);
    console.log(`Updated ${edits.length - functions.size} saves in ${path}.`);
}

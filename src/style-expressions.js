// Whitelisted declarative data expressions. Never evaluates JavaScript or loads URLs.
const operators = new Set(['get', 'coalesce', 'match', 'step', 'case', 'all', 'any', '==', '!=', '>', '>=', '<', '<=', 'literal']);
export function validateExpression(expression, budget = { nodes: 0 }, depth = 0) {
  if (++budget.nodes > 500 || depth > 20) throw Error('Expresión de estilo demasiado compleja.');
  if (!Array.isArray(expression)) {
    if (expression !== null && !['string', 'number', 'boolean'].includes(typeof expression)) throw Error('Valor de estilo no permitido.');
    if (typeof expression === 'number' && !Number.isFinite(expression)) throw Error('Valor numérico inválido.');
    return;
  }
  const [op, ...args] = expression;
  if (!operators.has(op)) throw Error('Operador de estilo no soportado.');
  if (op === 'get' && (args.length !== 1 || typeof args[0] !== 'string')) throw Error('Campo de estilo inválido.');
  if (op === 'literal') {
    if (args.length !== 1 || !Array.isArray(args[0]) || args[0].some(x => !['string', 'number', 'boolean'].includes(typeof x))) throw Error('Literal de estilo inválido.');
    budget.nodes += args[0].length; if (budget.nodes > 500) throw Error('Literal demasiado grande.');
    return;
  }
  if (['==', '!=', '>', '>=', '<', '<='].includes(op) && args.length !== 2) throw Error('Comparación inválida.');
  if (op === 'step' && (args.length < 2 || args.length % 2 !== 0)) throw Error('Escalones de estilo inválidos.');
  if (op === 'step') for (let i = 2; i < args.length; i += 2) {
    if (typeof args[i] !== 'number' || !Number.isFinite(args[i]) || i > 2 && args[i] <= args[i - 2]) throw Error('Los umbrales deben ser crecientes.');
  }
  if (op === 'match' && (args.length < 4 || args.length % 2 !== 0)) throw Error('Categorías inválidas.');
  if (op === 'case' && (args.length < 3 || args.length % 2 !== 1)) throw Error('Condiciones inválidas.');
  if (['any', 'all', 'coalesce'].includes(op) && !args.length) throw Error('Expresión vacía.');
  for (const [i, arg] of args.entries()) {
    if (op === 'match' && i % 2 === 1 && i < args.length - 1 && Array.isArray(arg) && arg[0] !== 'literal') {
      if (!arg.length || arg.some(value => !['string', 'number'].includes(typeof value))) throw Error('Etiquetas de categoría inválidas.');
      budget.nodes += arg.length; if (budget.nodes > 500) throw Error('Demasiadas etiquetas.');
    } else validateExpression(arg, budget, depth + 1);
  }
}
function evaluate(expression, properties) {
  if (!Array.isArray(expression)) return expression;
  const [op, ...args] = expression;
  const value = arg => evaluate(arg, properties);
  if (op === 'get') return Object.hasOwn(properties, args[0]) ? properties[args[0]] ?? null : null;
  if (op === 'literal') return args[0];
  if (op === 'coalesce') { for (const arg of args) { const result = value(arg); if (result !== null && result !== undefined) return result; } return null; }
  if (op === 'any') return args.some(arg => value(arg) === true);
  if (op === 'all') return args.every(arg => value(arg) === true);
  if (op === 'case') { for (let i = 0; i < args.length - 1; i += 2) if (value(args[i]) === true) return value(args[i + 1]); return value(args.at(-1)); }
  if (op === 'match') {
    const input = value(args[0]);
    for (let i = 1; i < args.length - 1; i += 2) {
      const labels = Array.isArray(args[i]) && args[i][0] !== 'literal' ? args[i] : value(args[i]);
      if (Array.isArray(labels) ? labels.includes(input) : labels === input) return value(args[i + 1]);
    }
    return value(args.at(-1));
  }
  if (op === 'step') {
    const input = value(args[0]); if (typeof input !== 'number' || !Number.isFinite(input)) throw Error('El campo de estilo no es numérico; no se convierte a cero.');
    let output = value(args[1]);
    for (let i = 2; i < args.length; i += 2) { if (input < args[i]) break; output = value(args[i + 1]); }
    return output;
  }
  const a = value(args[0]); const b = value(args[1]);
  if (op === '==') return a === b;
  if (op === '!=') return a !== b;
  if (typeof a !== typeof b || !['number', 'string'].includes(typeof a)) throw Error('Tipos de comparación incompatibles en estilo.');
  if (op === '>') return a > b;
  if (op === '>=') return a >= b;
  if (op === '<') return a < b;
  if (op === '<=') return a <= b;
  throw Error('Expresión no soportada.');
}
export function evaluateStyle(expression, properties = {}) { validateExpression(expression); return evaluate(expression, properties); }
const paintKeys = new Set(['fill-color', 'fill-opacity', 'line-color', 'line-opacity', 'line-width', 'circle-color', 'circle-opacity', 'circle-radius', 'circle-stroke-color', 'circle-stroke-width']);
export function validatePaint(paint) {
  if (!paint || typeof paint !== 'object' || Array.isArray(paint)) throw Error('Simbología declarativa inválida.');
  for (const [key, value] of Object.entries(paint)) {
    if (!paintKeys.has(key)) throw Error('Propiedad de simbología pendiente de soporte; no se sustituye silenciosamente.');
    validateExpression(value);
  }
  return paint;
}
export function resolvePaint(paint, properties) {
  validatePaint(paint);
  const resolved = Object.fromEntries(Object.entries(paint).map(([key, expression]) => [key, evaluateStyle(expression, properties)]));
  for (const [key, value] of Object.entries(resolved)) {
    if (key.endsWith('-color') && typeof value !== 'string') throw Error('Color no textual en la referencia.');
    if (key.endsWith('-opacity') && (!Number.isFinite(value) || value < 0 || value > 1)) throw Error('Opacidad fuera de rango.');
    if ((key.endsWith('-width') || key.endsWith('-radius')) && (!Number.isFinite(value) || value < 0 || value > 64)) throw Error('Tamaño de símbolo fuera de rango admitido.');
  }
  return resolved;
}

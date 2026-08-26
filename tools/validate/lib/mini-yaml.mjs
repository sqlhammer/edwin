#!/usr/bin/env node
/**
 * mini-yaml.mjs
 *
 * Minimal YAML frontmatter parser for edwin-doctor.
 *
 * SUPPORTS:
 * - Scalars (strings, numbers, booleans, null)
 * - Quoted strings (single and double quotes)
 * - Block scalars (literal | and folded >)
 * - Flow sequences: [a, b, c]
 * - Block sequences: - item
 * - Nested mappings (one level deep)
 * - Comments (#)
 *
 * DOES NOT SUPPORT (will reject with error):
 * - Anchors and aliases (&anchor, *alias)
 * - Multi-document markers (---)
 * - Complex nested structures beyond one level
 * - Tags (!!)
 * - Advanced flow mappings beyond simple lists
 */

export class YAMLParseError extends Error {
  constructor(message, line = null) {
    super(line !== null ? `Line ${line}: ${message}` : message);
    this.name = 'YAMLParseError';
    this.line = line;
  }
}

/**
 * Extract YAML frontmatter from markdown content
 * @param {string} content - Full file content
 * @returns {{ frontmatter: object | null, content: string, error: string | null }}
 */
export function extractFrontmatter(content) {
  const lines = content.split('\n');

  // Check for opening fence
  if (lines.length === 0 || lines[0].trim() !== '---') {
    return { frontmatter: null, content, error: null };
  }

  // Find closing fence
  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    return { frontmatter: null, content, error: 'Frontmatter opening fence found but no closing fence' };
  }

  const yamlLines = lines.slice(1, endIndex);
  const remainingContent = lines.slice(endIndex + 1).join('\n');

  try {
    const frontmatter = parseYAML(yamlLines.join('\n'));
    return { frontmatter, content: remainingContent, error: null };
  } catch (err) {
    return { frontmatter: null, content: remainingContent, error: err.message };
  }
}

/**
 * Parse YAML string into JavaScript object
 * @param {string} yaml - YAML content
 * @returns {object}
 */
export function parseYAML(yaml) {
  const lines = yaml.split('\n');
  const result = {};
  let currentKey = null;
  let currentValue = [];
  let inBlockScalar = false;
  let blockScalarType = null;
  let blockScalarIndent = 0;

  // Check for unsupported features
  if (yaml.includes('&') || yaml.includes('*')) {
    throw new YAMLParseError('Anchors and aliases are not supported');
  }
  if (yaml.includes('!!')) {
    throw new YAMLParseError('YAML tags are not supported');
  }

  const flushBlockScalar = () => {
    if (currentKey && inBlockScalar) {
      if (blockScalarType === '|') {
        result[currentKey] = currentValue.join('\n');
      } else if (blockScalarType === '>') {
        result[currentKey] = currentValue.join(' ').trim();
      }
      currentKey = null;
      currentValue = [];
      inBlockScalar = false;
      blockScalarType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip empty lines and comments (unless in block scalar)
    if (!inBlockScalar) {
      const trimmed = line.trim();
      if (trimmed === '' || trimmed.startsWith('#')) {
        continue;
      }
    }

    // Handle block scalar continuation
    if (inBlockScalar) {
      const indent = line.search(/\S/);
      if (indent === -1) {
        // Empty line in block scalar
        currentValue.push('');
        continue;
      }
      if (indent >= blockScalarIndent) {
        currentValue.push(line.slice(blockScalarIndent));
        continue;
      } else {
        // Dedented line - end of block scalar
        flushBlockScalar();
        // Fall through to process this line normally
      }
    }

    // Parse key-value pairs
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0 && !line.slice(0, colonIndex).includes('#')) {
      flushBlockScalar();

      const key = line.slice(0, colonIndex).trim();
      const rest = line.slice(colonIndex + 1).trim();

      if (rest === '') {
        // Key with no value on same line - might be nested or block scalar
        currentKey = key;
        continue;
      }

      // Block scalar indicator
      if (rest === '|' || rest === '>') {
        currentKey = key;
        inBlockScalar = true;
        blockScalarType = rest;
        blockScalarIndent = line.search(/\S/) + 2; // Default indent
        currentValue = [];
        continue;
      }

      // Flow sequence
      if (rest.startsWith('[') && rest.endsWith(']')) {
        result[key] = parseFlowSequence(rest, lineNum);
        continue;
      }

      // Simple value
      result[key] = parseValue(rest, lineNum);
      continue;
    }

    // Block sequence item
    if (line.trim().startsWith('- ')) {
      if (!currentKey) {
        throw new YAMLParseError('Block sequence item without parent key', lineNum);
      }
      if (!Array.isArray(result[currentKey])) {
        result[currentKey] = [];
      }
      const value = line.trim().slice(2).trim();
      result[currentKey].push(parseValue(value, lineNum));
      continue;
    }

    // If we get here and have a non-empty line, it's unsupported syntax
    if (line.trim() !== '') {
      throw new YAMLParseError(`Unsupported YAML syntax: ${line.trim()}`, lineNum);
    }
  }

  flushBlockScalar();

  return result;
}

/**
 * Parse a flow sequence like [a, b, c]
 */
function parseFlowSequence(str, lineNum) {
  const inner = str.slice(1, -1).trim();
  if (inner === '') return [];

  const items = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = null;

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];

    if (inQuotes) {
      if (ch === quoteChar && (i === 0 || inner[i - 1] !== '\\')) {
        inQuotes = false;
        quoteChar = null;
      }
      current += ch;
    } else {
      if (ch === '"' || ch === "'") {
        inQuotes = true;
        quoteChar = ch;
        current += ch;
      } else if (ch === ',') {
        items.push(parseValue(current.trim(), lineNum));
        current = '';
      } else {
        current += ch;
      }
    }
  }

  if (current.trim()) {
    items.push(parseValue(current.trim(), lineNum));
  }

  return items;
}

/**
 * Parse a scalar value
 */
function parseValue(str, lineNum) {
  str = str.trim();

  // Quoted string
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }

  // Boolean
  if (str === 'true') return true;
  if (str === 'false') return false;

  // Null
  if (str === 'null' || str === '~') return null;

  // Number
  if (/^-?\d+(\.\d+)?$/.test(str)) {
    return parseFloat(str);
  }

  // Unquoted string
  return str;
}

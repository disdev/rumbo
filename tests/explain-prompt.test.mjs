// buildExplainPrompt: texto listo para pegar en ChatGPT por cada pregunta
// fallada en un simulacro o quiz por tema (mentor directive 2026-09-22).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExplainPrompt } from '../src/js/explain-prompt.js';

const item = {
  category: 'NAVEGACIÓN',
  question: '¿Qué instrumento mide el rumbo magnético?',
  options: ['Altímetro', 'Brújula magnética', 'Variómetro'],
  answer: 1,
};

test('incluye la categoría y el texto de la pregunta', () => {
  const prompt = buildExplainPrompt(item);
  assert.ok(prompt.includes('NAVEGACIÓN'));
  assert.ok(prompt.includes('¿Qué instrumento mide el rumbo magnético?'));
});

test('lista las opciones con letras A) B) C)', () => {
  const prompt = buildExplainPrompt(item);
  assert.ok(prompt.includes('A) Altímetro'));
  assert.ok(prompt.includes('B) Brújula magnética'));
  assert.ok(prompt.includes('C) Variómetro'));
});

test('señala el texto de la opción correcta según answer, no el índice', () => {
  const prompt = buildExplainPrompt(item);
  assert.ok(prompt.includes('correcta es: "Brújula magnética"'));
});

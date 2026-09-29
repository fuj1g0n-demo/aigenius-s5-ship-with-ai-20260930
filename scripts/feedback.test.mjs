import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { FEEDBACK_LIMITS, loadSubmissions, saveSubmission } from '../src/lib/feedback.js';

const STORAGE_KEY = 'ship-with-ai-feedback';

function mockStorage(t) {
  const data = new Map();
  const storage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  });
  return storage;
}

test('feedback is trimmed and stored without changing existing topic-less entries', (t) => {
  const storage = mockStorage(t);
  const legacy = { name: 'Ada', message: 'Earlier feedback', submittedAt: '2026-01-01T00:00:00.000Z' };
  storage.setItem(STORAGE_KEY, JSON.stringify([legacy]));
  const submissions = saveSubmission('  Grace  ', '  **Useful** lesson! \n', '  Supply chain  ');
  assert.deepEqual(submissions[0], legacy);
  assert.equal(submissions[1].name, 'Grace');
  assert.equal(submissions[1].message, '**Useful** lesson!');
  assert.equal(submissions[1].topic, 'Supply chain');
  assert.ok(Number.isFinite(Date.parse(submissions[1].submittedAt)));
  assert.deepEqual(loadSubmissions(), submissions);
});

test('feedback allows an anonymous name and exact maximum field lengths', (t) => {
  mockStorage(t);
  assert.equal(saveSubmission(' \t ', 'Message', 'Topic')[0].name, '');
  const submissions = saveSubmission(
    'n'.repeat(FEEDBACK_LIMITS.name),
    'm'.repeat(FEEDBACK_LIMITS.message),
    't'.repeat(FEEDBACK_LIMITS.topic),
  );
  assert.equal(submissions.length, 2);
});

test('invalid feedback is rejected without modifying storage', (t) => {
  const storage = mockStorage(t);
  saveSubmission('Ada', 'Message', 'Topic');
  const before = storage.getItem(STORAGE_KEY);
  const invalid = [
    ['', '', 'Topic'],
    ['', ' \n\t ', 'Topic'],
    ['', 'Message', ''],
    ['', 'Message', ' \n\t '],
    ['n'.repeat(FEEDBACK_LIMITS.name + 1), 'Message', 'Topic'],
    ['', 'm'.repeat(FEEDBACK_LIMITS.message + 1), 'Topic'],
    ['', 'Message', 't'.repeat(FEEDBACK_LIMITS.topic + 1)],
    [null, 'Message', 'Topic'],
    ['', undefined, 'Topic'],
    ['', 'Message', { toString: () => 'Topic' }],
  ];
  for (const values of invalid) {
    assert.throws(() => saveSubmission(...values), /required|characters or fewer|must be text/);
    assert.equal(storage.getItem(STORAGE_KEY), before);
  }
});

test('storage failures propagate to the caller without losing saved feedback', (t) => {
  const storage = mockStorage(t);
  saveSubmission('Ada', 'Message', 'Topic');
  const before = storage.getItem(STORAGE_KEY);
  t.mock.method(storage, 'setItem', () => { throw new Error('Storage quota exceeded'); });
  assert.throws(() => saveSubmission('', 'Another message', 'Topic'), /Storage quota exceeded/);
  assert.equal(storage.getItem(STORAGE_KEY), before);
});

test('form displays validation and storage errors, preserves input, and resets only on success', (t) => {
  const storage = mockStorage(t);
  const source = readFileSync(new URL('../src/components/FeedbackWidget.astro', import.meta.url), 'utf8');
  const script = source.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/^\s*import .+;$/gm, '');
  let submit;
  let resets = 0;
  const values = { name: 'Ada', message: '  ', topic: 'Topic' };
  const form = {
    addEventListener: (event, handler) => { if (event === 'submit') submit = handler; },
    reset: () => { resets += 1; },
  };
  const list = { innerHTML: '' };
  const error = { hidden: true, textContent: '' };
  const loggedErrors = [];
  runInNewContext(script, {
    document: {
      getElementById: (id) => ({
        'feedback-form': form,
        'feedback-list': list,
        'feedback-error': error,
      })[id],
    },
    FormData: class { get(key) { return values[key]; } },
    Error,
    loadSubmissions,
    saveSubmission,
    markedModule: { marked: (message) => `<p>${message}</p>` },
    FEEDBACK_ANALYTICS_TOKEN: 'fake',
    console: { debug() {}, error: (...args) => loggedErrors.push(args) },
  });
  const event = { preventDefault() {} };
  submit(event);
  assert.equal(resets, 0);
  assert.equal(error.hidden, false);
  assert.match(error.textContent, /Message is required/);
  assert.equal(list.innerHTML, '');

  values.message = 'Good lesson';
  const failure = t.mock.method(storage, 'setItem', () => { throw new Error('Storage quota exceeded'); });
  submit(event);
  assert.equal(resets, 0);
  assert.equal(error.hidden, false);
  assert.match(error.textContent, /Storage quota exceeded/);
  assert.equal(loggedErrors.length, 2);

  failure.mock.restore();
  submit(event);
  assert.equal(resets, 1);
  assert.equal(error.hidden, true);
  assert.equal(error.textContent, '');
  assert.match(list.innerHTML, /Good lesson/);
});

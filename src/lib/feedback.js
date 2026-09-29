// Feedback widget storage + submit handling.

const STORAGE_KEY = 'ship-with-ai-feedback';

export const FEEDBACK_LIMITS = { name: 80, topic: 120, message: 2000 };

function normalizeField(value, label, maxLength, required) {
  if (typeof value !== 'string') {
    throw new TypeError(`${label} must be text.`);
  }
  const normalized = value.trim();
  if (required && !normalized) {
    throw new Error(`${label} is required.`);
  }
  if (normalized.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }
  return normalized;
}

export function loadSubmissions() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveSubmission(name, message, topic) {
  name = normalizeField(name, 'Name', FEEDBACK_LIMITS.name, false);
  message = normalizeField(message, 'Message', FEEDBACK_LIMITS.message, true);
  topic = normalizeField(topic, 'Topic', FEEDBACK_LIMITS.topic, true);
  const submissions = loadSubmissions();
  submissions.push({ name, message, topic, submittedAt: new Date().toISOString() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(submissions));
  return submissions;
}

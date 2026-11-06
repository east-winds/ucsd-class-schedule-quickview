import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createClassPlannerClient,
  displayCourseNumber,
  filterByInstructor,
  instructorMatches,
  parseCourse,
  parseInstructor,
  usesClassPlanner,
} from '../src/classplanner.js';
import { renderClassPlannerCourses } from '../src/render-classplanner.js';
import { NO_RESULTS_HTML } from '../src/extract.js';

const sample = () => JSON.parse(readFileSync(new URL('./fixtures/classplanner-search.json', import.meta.url), 'utf8'));

function mockFetch(handler) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = init?.body ? JSON.parse(init.body) : null;
    calls.push({ url, body });
    const { status = 200, json } = handler(url, body, calls.length);
    return { ok: status >= 200 && status < 300, status, json: async () => json };
  };
  return { fetchImpl, calls };
}

test('terms from FA26 on use Class Planner; older terms stay on act.ucsd.edu', () => {
  for (const t of ['FA26', 'WI27', 'SP27', 'SA27', 'FA30']) assert.equal(usesClassPlanner(t), true, t);
  for (const t of ['SA26', 'SP26', 'WI26', 'FA25', 'WI20']) assert.equal(usesClassPlanner(t), false, t);
});

test('parses course and instructor queries', () => {
  assert.deepEqual(parseCourse('GPPS 428'), { subject: 'GPPS', number: '428' });
  assert.deepEqual(parseCourse('cse8a'), { subject: 'CSE', number: '8A' });
  assert.deepEqual(parseCourse('CSE 008A'), { subject: 'CSE', number: '8A' });
  assert.equal(parseCourse('energy policy'), null);
  assert.deepEqual(parseInstructor('Davidson, Michael'), { last: 'davidson', first: 'michael' });
  assert.deepEqual(parseInstructor('Michael Davidson'), { last: 'davidson', first: 'michael' });
  assert.deepEqual(parseInstructor('Davidson'), { last: 'davidson', first: '' });
});

test('course numbers drop Class Planner zero padding', () => {
  assert.equal(displayCourseNumber({ subject_code: 'CSE', course_code: '008A' }), '8A');
  assert.equal(displayCourseNumber({ subject_code: 'CSE', course_code: 'CSE-008A' }), '8A');
  assert.equal(displayCourseNumber({ subject_code: 'GPPS', course_code: '428' }), '428');
});

test('instructor matching needs the whole last name and the first initial', () => {
  const name = { last: 'davidson', first: 'michael' };
  assert.ok(instructorMatches('Michael Davidson', name));
  assert.ok(instructorMatches('Mike Davidson', name));
  assert.ok(instructorMatches('Davidson, Michael R', name));
  assert.ok(!instructorMatches('Pat Davidsonn', name));
  assert.ok(!instructorMatches('Sarah Davidson', name));
  assert.ok(instructorMatches('Sarah Davidson', { last: 'davidson', first: '' }));
});

test('instructor filter keeps their sections and the sections that go with them', () => {
  const courses = filterByInstructor(sample().courses, { last: 'davidson', first: 'michael' });
  assert.equal(courses.length, 1);
  assert.equal(courses[0].subject_code, 'GPPS');
  assert.deepEqual(courses[0].sections.map((s) => s.section_code), ['A00', 'A01']);
});

test('renders a results table in the legacy style', () => {
  const { found, html } = renderClassPlannerCourses(sample().courses);
  assert.equal(found, true);
  assert.match(html, /^<table class="tbrdr">/);
  assert.ok(html.includes('GPPS 428'));
  assert.ok(html.includes('CSE 8A'));
  assert.ok(html.includes('>TR<'), 'Tue/Thu meetings merge into one row');
  assert.ok(html.includes('9:30a-10:50a'));
  assert.ok(html.includes('FI 2027-03-16'), 'final exam row');
  assert.ok(html.includes('FULL / 30'));
  assert.ok(html.includes('&lt;I&gt;'), 'titles are escaped');
  assert.ok(!html.includes('<I>'));
});

test('no courses renders the shared "No results found." message', () => {
  assert.deepEqual(renderClassPlannerCourses([]), { found: false, html: NO_RESULTS_HTML });
});

test('course search sends course_key and keeps only that course', async () => {
  const { fetchImpl, calls } = mockFetch(() => ({ json: sample() }));
  const client = createClassPlannerClient({ fetchImpl });
  const { courses } = await client.search({ term: 'WI27', mode: 'course', query: 'GPPS 428' });
  assert.deepEqual(courses.map((c) => c.subject_code), ['GPPS']);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.term_code, 'WI27');
  assert.deepEqual(calls[0].body.course_key, ['GPPS 428']);
  assert.equal(calls[0].body.limit, 48);
});

test('falls back to the older API route when the public one is missing', async () => {
  const { fetchImpl, calls } = mockFetch((url) =>
    url.includes('/public/') ? { status: 404, json: { detail: 'Not Found' } } : { json: sample() },
  );
  const client = createClassPlannerClient({ fetchImpl });
  const { courses } = await client.search({ term: 'WI27', mode: 'prof', query: 'Davidson, Michael' });
  assert.equal(courses.length, 1);
  assert.ok(calls[0].url.includes('/api/v1/public/catalog/courses/search'));
  assert.ok(calls[1].url.endsWith('/api/v1/catalog/courses/search'));
  assert.deepEqual(calls[1].body.instructor, ['Michael Davidson']);
});

test('prof search falls back to a last-name text search', async () => {
  const { fetchImpl, calls } = mockFetch((url, body) =>
    body.instructor.length ? { json: { total: 0, courses: [] } } : { json: sample() },
  );
  const client = createClassPlannerClient({ fetchImpl });
  const { courses } = await client.search({ term: 'WI27', mode: 'prof', query: 'Davidson, Michael' });
  assert.equal(courses.length, 1);
  assert.equal(calls[1].body.q, 'Davidson');
});

test('pages through results 48 at a time', async () => {
  const course = (i) => ({ subject_code: 'MATH', course_code: String(i), instructors: ['Ann Lee'], sections: [{ section_code: 'A00', instructors: ['Ann Lee'] }] });
  const { fetchImpl, calls } = mockFetch((url, body) => ({
    json: { total: 60, offset: body.offset, courses: Array.from({ length: Math.min(48, 60 - body.offset) }, (_, i) => course(body.offset + i)) },
  }));
  const client = createClassPlannerClient({ fetchImpl });
  const { courses, truncated } = await client.search({ term: 'WI27', mode: 'prof', query: 'Lee, Ann' });
  assert.equal(courses.length, 60);
  assert.equal(truncated, false);
  assert.deepEqual(calls.map((c) => c.body.offset), [0, 48]);
});

test('a sign-in error on every route is reported, not swallowed', async () => {
  const { fetchImpl } = mockFetch(() => ({ status: 401, json: { detail: 'Sign in to continue' } }));
  const client = createClassPlannerClient({ fetchImpl });
  await assert.rejects(client.search({ term: 'WI27', mode: 'course', query: 'GPPS 428' }), /HTTP 401/);
});

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
  TermNotAvailableError,
  usesClassPlanner,
} from '../src/classplanner.js';
import { renderClassPlannerCourses } from '../src/render-classplanner.js';
import { NO_RESULTS_HTML } from '../src/extract.js';

// Real responses captured from classplanner.apps.ucsd.edu (FA26), trimmed.
const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const searchFixture = () => fixture('classplanner-search.json');
const filtersFixture = () => fixture('classplanner-filters.json');

const SEARCH_URL = 'https://classplanner.apps.ucsd.edu/api/v1/public/catalog/courses/search';

function mockFetch(handler) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = init?.body ? JSON.parse(init.body) : null;
    calls.push({ url, method: init?.method || 'GET', body });
    const { status = 200, json } = handler(url, body);
    return { ok: status >= 200 && status < 300, status, json: async () => json };
  };
  return { fetchImpl, calls };
}

// Serves the filters list, and a search that honors the instructor filter.
const fakeClassPlanner = (url, body) => {
  if (url.includes('/filters?')) return { json: filtersFixture() };
  const all = searchFixture().courses;
  const courses = body.instructor.length
    ? all.filter((c) => c.instructors.some((n) => body.instructor.includes(n)))
    : all;
  return { json: { term_code: body.term_code, total: courses.length, offset: body.offset, courses } };
};

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
  assert.ok(instructorMatches('Andrew Whitworth-Smith', { last: 'whitworth-smith', first: 'andrew' }));
  assert.ok(!instructorMatches('George Porter', { last: 'porter', first: 'leo' }));
});

test('instructor filter keeps only their sections of shared courses', () => {
  const courses = filterByInstructor(searchFixture().courses, { last: 'davidson', first: 'michael' });
  assert.deepEqual(courses.map((c) => `${c.subject_code} ${c.course_code}`), ['CSS 296', 'MAE 299']);
  for (const c of courses) {
    assert.ok(c.sections.length >= 1);
    for (const s of c.sections) assert.deepEqual(s.instructors, ['Michael Davidson']);
  }
});

test('instructor filter keeps a lecture together with its discussions and labs', () => {
  const [cse8a] = filterByInstructor(searchFixture().courses, { last: 'porter', first: 'leo' })
    .filter((c) => c.course_code === '008A');
  const original = searchFixture().courses.find((c) => c.course_code === '008A');
  assert.equal(cse8a.sections.length, original.sections.length);
});

test('renders a results table in the legacy style', () => {
  const { found, html } = renderClassPlannerCourses(searchFixture().courses.filter((c) => c.course_code === '008A'));
  assert.equal(found, true);
  assert.match(html, /^<table class="tbrdr">/);
  assert.ok(html.includes('CSE 8A'));
  assert.ok(html.includes('Intro to Programming 1 (4 units)'));
  assert.ok(html.includes('>TR<'), 'Tue/Thu meetings merge into one row');
  assert.ok(html.includes('11:00am-12:20pm'));
  assert.ok(html.includes('FI 2026-12-09'), 'final exam row');
  assert.ok(html.includes('118 / 362'));
  assert.ok(!html.includes('>Room<'), 'no Room column when Class Planner gives no rooms');
});

test('shows a Room column when rooms are present', () => {
  const course = { subject_code: 'X', course_code: '1', sections: [{ section_code: 'A00', meetings: [{ meeting_kind: 'class', day_code: 'M', start_time_display: '9:00am', end_time_display: '9:50am', room_code: 'GH 242' }] }] };
  const { html } = renderClassPlannerCourses([course]);
  assert.ok(html.includes('>Room<'));
  assert.ok(html.includes('>GH 242<'));
  assert.ok(html.includes('colspan="9"'));
});

test('escapes text from Class Planner', () => {
  const { html } = renderClassPlannerCourses([{ subject_code: 'X', course_code: '1', module_name: '<b>Hi</b>', sections: [] }]);
  assert.ok(html.includes('&lt;b&gt;Hi&lt;/b&gt;'));
});

test('no courses renders the shared "No results found." message', () => {
  assert.deepEqual(renderClassPlannerCourses([]), { found: false, html: NO_RESULTS_HTML });
});

test('course search sends a zero-padded course_key and keeps only that course', async () => {
  const { fetchImpl, calls } = mockFetch(fakeClassPlanner);
  const client = createClassPlannerClient({ fetchImpl });
  const { courses } = await client.search({ term: 'FA26', mode: 'course', query: 'CSE 8A' });
  assert.deepEqual(courses.map((c) => c.course_code), ['008A']);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, SEARCH_URL);
  assert.equal(calls[0].body.term_code, 'FA26');
  assert.deepEqual(calls[0].body.course_key, ['CSE 008A', 'CSE 8A']);
  assert.equal(calls[0].body.limit, 48);
});

test('prof search looks up exact instructor names, then filters by them', async () => {
  const { fetchImpl, calls } = mockFetch(fakeClassPlanner);
  const client = createClassPlannerClient({ fetchImpl });
  const { courses } = await client.search({ term: 'FA26', mode: 'prof', query: 'Davidson, Michael' });
  assert.deepEqual(courses.map((c) => c.subject_code), ['CSS', 'MAE']);
  assert.equal(calls[0].url, 'https://classplanner.apps.ucsd.edu/api/v1/public/catalog/filters?term_code=FA26');
  assert.deepEqual(calls[1].body.instructor, ['Michael Davidson']);
});

test('prof search with an unknown name makes no search request', async () => {
  const { fetchImpl, calls } = mockFetch(fakeClassPlanner);
  const client = createClassPlannerClient({ fetchImpl });
  const { courses } = await client.search({ term: 'FA26', mode: 'prof', query: 'Nobody, Xyz' });
  assert.deepEqual(courses, []);
  assert.equal(calls.length, 1);
});

test('pages through results 48 at a time', async () => {
  const course = (i) => ({ subject_code: 'MATH', course_code: String(i), instructors: ['Leo Porter'], sections: [{ section_code: 'A00', instructors: ['Leo Porter'] }] });
  const { fetchImpl, calls } = mockFetch((url, body) =>
    url.includes('/filters?')
      ? { json: filtersFixture() }
      : { json: { total: 60, offset: body.offset, courses: Array.from({ length: Math.min(48, 60 - body.offset) }, (_, i) => course(body.offset + i)) } },
  );
  const client = createClassPlannerClient({ fetchImpl });
  const { courses, truncated } = await client.search({ term: 'FA26', mode: 'prof', query: 'Porter, Leo' });
  assert.equal(courses.length, 60);
  assert.equal(truncated, false);
  assert.deepEqual(calls.slice(1).map((c) => c.body.offset), [0, 48]);
});

test('an unpublished term raises TermNotAvailableError', async () => {
  // Class Planner's real answer for WI27 on 2026-11-06.
  const { fetchImpl } = mockFetch(() => ({ status: 404, json: { detail: 'This term is not available in the public Schedule of Classes.' } }));
  const client = createClassPlannerClient({ fetchImpl });
  await assert.rejects(client.search({ term: 'WI27', mode: 'course', query: 'CSE 8A' }), TermNotAvailableError);
});

test('a sign-in error is reported, not swallowed', async () => {
  const { fetchImpl } = mockFetch(() => ({ status: 401, json: { detail: 'Sign in to continue' } }));
  const client = createClassPlannerClient({ fetchImpl });
  await assert.rejects(client.search({ term: 'FA26', mode: 'course', query: 'CSE 8A' }), /HTTP 401: Sign in to continue/);
});

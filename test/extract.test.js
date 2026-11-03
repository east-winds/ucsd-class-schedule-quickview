import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractRelevantMarkup, NO_RESULTS_HTML, UNPARSEABLE_HTML } from '../src/extract.js';

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

const UNWANTED = ['Your search was', 'tdr_footer', 'Regents of the University', 'Printer', 'Start a new search', '<script', '</form>'];

for (const name of ['prof-results.html', 'course-results-large.html']) {
  test(`${name}: keeps only the results table`, () => {
    const { found, html } = extractRelevantMarkup(fixture(name));
    assert.equal(found, true);
    assert.match(html, /^<table\b[^>]*class="tbrdr"/);
    assert.match(html, /<\/table>$/);
    for (const s of UNWANTED) assert.ok(!html.includes(s), `output should not contain ${JSON.stringify(s)}`);
  });

  test(`${name}: root-relative links point at UCSD`, () => {
    const { html } = extractRelevantMarkup(fixture(name));
    assert.ok(!/(href|src)=["']\/(?!\/)/.test(html), 'no root-relative href/src left');
    assert.ok(!/(openNewWindow|openNewTab|sendMail)\(["']\/(?!\/)/.test(html), 'no root-relative JS links left');
  });
}

test('prof-results.html: contains the expected course', () => {
  const { html } = extractRelevantMarkup(fixture('prof-results.html'));
  assert.ok(html.includes('Davidson, Michael'));
  assert.ok(html.includes('https://act.ucsd.edu/FacultyClasslist/'));
});

test('no-results page returns only the no-results message', () => {
  assert.deepEqual(extractRelevantMarkup(fixture('prof-no-results.html')), { found: false, html: NO_RESULTS_HTML });
});

test('unrecognized or empty page returns a parse warning', () => {
  assert.deepEqual(extractRelevantMarkup('<html><body>Maintenance</body></html>'), { found: false, html: UNPARSEABLE_HTML });
  assert.deepEqual(extractRelevantMarkup(''), { found: false, html: UNPARSEABLE_HTML });
});

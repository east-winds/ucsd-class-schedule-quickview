import { extractRelevantMarkup } from './extract.js';

const SEARCH_ENDPOINT = 'https://act.ucsd.edu/scheduleOfClasses/scheduleOfClassesFacultyResult.htm';
const SEARCH_PAGE_REFERER = 'https://act.ucsd.edu/scheduleOfClasses/scheduleOfClassesFaculty.htm';

export default {
  async fetch(request) {
    try {
      const url = new URL(request.url);

      if (url.pathname === '/healthz') {
        return json({ ok: true, service: 'ucsd-class-schedule-quickview-worker' });
      }

      if (url.pathname === '/api/search') {
        return await handleSearch(url);
      }

      return html(renderHomePage(url));
    } catch (err) {
      return json(
        {
          error: 'Unexpected server error',
          details: err instanceof Error ? err.message : String(err),
        },
        500,
      );
    }
  },
};

async function handleSearch(url) {
  const mode = (url.searchParams.get('mode') || 'prof').toLowerCase();
  const q = (url.searchParams.get('q') || '').trim();
  const years = clampYears(url.searchParams.get('years'));
  const format = (url.searchParams.get('format') || 'html').toLowerCase();

  if (!q) {
    return json({ error: 'Missing required query parameter: q' }, 400);
  }

  if (!['prof', 'course'].includes(mode)) {
    return json({ error: 'mode must be either "prof" or "course"' }, 400);
  }

  const terms = getTerms(years);
  const results = [];

  for (const term of terms) {
    const body = buildFormBody({ term, mode, query: q });
    const response = await fetch(SEARCH_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        origin: 'https://act.ucsd.edu',
        referer: SEARCH_PAGE_REFERER,
        'user-agent': 'Mozilla/5.0',
      },
      body,
      redirect: 'follow',
    });

    const responseHtml = await response.text();
    const { found, html: resultHtml } = response.ok
      ? extractRelevantMarkup(responseHtml)
      : { found: false, html: `<p class="no-results">Upstream request failed with status ${response.status}.</p>` };
    results.push({
      term,
      ok: response.ok,
      status: response.status,
      found,
      body: resultHtml,
    });
  }

  if (format === 'json') {
    return json({ mode, q, years, terms, results });
  }

  return html(renderResultsPage({ mode, q, years, terms, results }));
}

function buildFormBody({ term, mode, query }) {
  const params = new URLSearchParams();

  params.set('selectedTerm', term);
  params.set('tabNum', mode === 'prof' ? 'tabs-ins' : 'tabs-crs');

  // General schedule option defaults copied from the original shell scripts.
  appendDefaults(params, {
    _selectedSubjects: '1',
    schedOption1: 'true',
    _schedOption1: 'on',
    _schedOption11: 'on',
    _schedOption12: 'on',
    schedOption2: 'true',
    _schedOption2: 'on',
    _schedOption4: 'on',
    _schedOption5: 'on',
    _schedOption3: 'on',
    _schedOption7: 'on',
    _schedOption8: 'on',
    _schedOption13: 'on',
    _schedOption10: 'on',
    _schedOption9: 'on',
    schStartTime: '12:00',
    schStartAmPm: '0',
    schEndTime: '12:00',
    schEndAmPm: '0',
    _selectedDepartments: '1',
    schedOption1Dept: 'true',
    _schedOption1Dept: 'on',
    _schedOption11Dept: 'on',
    _schedOption12Dept: 'on',
    schedOption2Dept: 'true',
    _schedOption2Dept: 'on',
    _schedOption4Dept: 'on',
    _schedOption5Dept: 'on',
    _schedOption3Dept: 'on',
    _schedOption7Dept: 'on',
    _schedOption8Dept: 'on',
    _schedOption13Dept: 'on',
    _schedOption10Dept: 'on',
    _schedOption9Dept: 'on',
    schStartTimeDept: '12:00',
    schStartAmPmDept: '0',
    schEndTimeDept: '12:00',
    schEndAmPmDept: '0',
    instructorType: 'begin',
    titleType: 'contain',
    title: '',
    _hideFullSec: 'on',
    _showPopup: 'on',
  });

  for (const day of ['M', 'T', 'W', 'R', 'F', 'S']) {
    params.append('schDay', day);
    params.append('_schDay', 'on');
    params.append('schDayDept', day);
    params.append('_schDayDept', 'on');
  }

  // The original scripts included this malformed field. Keeping the key only would be odd,
  // so we omit it here.
  params.set('sections', '');

  if (mode === 'prof') {
    params.set('courses', '');
    params.set('instructor', query);
  } else {
    params.set('courses', query);
    params.set('instructor', '');
  }

  return params.toString();
}

function appendDefaults(params, kv) {
  for (const [key, value] of Object.entries(kv)) {
    params.append(key, value);
  }
}

function clampYears(value) {
  const parsed = Number.parseInt(value || '3', 10);
  if (!Number.isFinite(parsed)) return 3;
  return Math.min(Math.max(parsed, 0), 10);
}

function getTerms(noYears) {
  const now = new Date();
  const currYr = Number(String(now.getFullYear()).slice(-2));
  const currMo = now.getMonth() + 1;
  let terms = [];
  let y = currYr - noYears;

  for (; y < currYr; y += 1) {
    terms = [`FA${pad2(y)}`, `SA${pad2(y)}`, `SP${pad2(y)}`, `WI${pad2(y)}`, ...terms];
  }

  if (currMo >= 1 && currMo <= 3) {
    terms = [`SP${pad2(y)}`, `WI${pad2(y)}`, ...terms];
  } else if (currMo >= 4 && currMo <= 6) {
    terms = [`SA${pad2(y)}`, `SP${pad2(y)}`, `WI${pad2(y)}`, ...terms];
  } else if (currMo >= 7 && currMo <= 9) {
    terms = [`FA${pad2(y)}`, `SA${pad2(y)}`, `SP${pad2(y)}`, `WI${pad2(y)}`, ...terms];
  } else {
    terms = [`WI${pad2(y + 1)}`, `FA${pad2(y)}`, `SA${pad2(y)}`, `SP${pad2(y)}`, `WI${pad2(y)}`, ...terms];
  }

  return terms;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function renderHomePage(url) {
  const exampleProf = `${url.origin}/api/search?mode=prof&q=Davidson%2C%20Michael&years=3`;
  const exampleCourse = `${url.origin}/api/search?mode=course&q=GPPS%20428&years=3`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>UCSD Class Schedule Quickview</title>
  <style>
    :root { color-scheme: dark; --bg: #000; --fg: #fff; --muted: #a3a3a3; --line: #333; --panel: #111; --panel-2: #1a1a1a; --link: #8ab4ff; --link-visited: #c4a1ff; }
    html, body { background: var(--bg); color: var(--fg); }
    a { color: var(--link); }
    a:visited { color: var(--link-visited); }
    body { font-family: system-ui, sans-serif; margin: 2rem auto; max-width: 900px; padding: 0 1rem; line-height: 1.5; }
    form { display: grid; gap: 0.75rem; margin: 1.5rem 0; }
    input, select, button { font: inherit; padding: 0.65rem 0.8rem; border-radius: 4px; }
    input, select { background: var(--bg); color: var(--fg); border: 1px solid #555; }
    input::placeholder { color: #777; }
    input:focus, select:focus, button:focus-visible { outline: 2px solid var(--fg); outline-offset: 1px; }
    button { background: var(--fg); color: var(--bg); border: 1px solid var(--fg); font-weight: 600; cursor: pointer; }
    button:hover { background: #d4d4d4; }
    .row { display: grid; grid-template-columns: 1fr 180px 160px; gap: 0.75rem; }
    @media (max-width: 700px) { .row { grid-template-columns: 1fr; } }
    .muted { color: var(--muted); }
    code { background: var(--panel-2); color: var(--fg); padding: 0.1rem 0.3rem; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>UCSD Class Schedule Quickview</h1>
  <p>Search recent UCSD class offerings by professor or course name.</p>
  <form action="/api/search" method="get">
    <div class="row">
      <input name="q" placeholder="Davidson, Michael or GPPS 428" required />
      <select name="mode">
        <option value="prof">Professor</option>
        <option value="course">Course</option>
      </select>
      <input name="years" type="number" min="0" max="10" value="3" />
    </div>
    <div>
      <button type="submit">Search</button>
    </div>
  </form>

  <p class="muted">JSON output: add <code>&format=json</code>.</p>
  <p class="muted">Example professor search: <a href="${escapeHtml(exampleProf)}">${escapeHtml(exampleProf)}</a></p>
  <p class="muted">Example course search: <a href="${escapeHtml(exampleCourse)}">${escapeHtml(exampleCourse)}</a></p>
</body>
</html>`;
}

function renderResultsPage({ mode, q, years, terms, results }) {
  const safeQ = escapeHtml(q);
  const foundCount = results.filter((r) => r.found).length;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>UCSD Quickview Results</title>
  <style>
    :root { color-scheme: dark; --bg: #000; --fg: #fff; --muted: #a3a3a3; --line: #333; --panel: #111; --panel-2: #1a1a1a; --link: #8ab4ff; --link-visited: #c4a1ff; }
    html, body { background: var(--bg); color: var(--fg); }
    a { color: var(--link); }
    a:visited { color: var(--link-visited); }
    body { font-family: system-ui, sans-serif; margin: 1.5rem auto; max-width: 1100px; padding: 0 1rem 4rem; line-height: 1.45; }
    .top { margin-bottom: 1.5rem; }
    .muted { color: var(--muted); }
    .term { margin: 1.75rem 0; border-top: 1px solid var(--line); padding-top: 1rem; }
    .term h2 { margin: 0 0 0.75rem; }
    .no-results { color: var(--muted); font-style: italic; margin: 0; }
    .term:has(.no-results) h2 { color: var(--muted); font-size: 1.1rem; }
    /* Table layout from the UCSD Schedule of Classes page, recolored for a dark background. */
    table.tbrdr { border: 1px solid var(--line); border-collapse: collapse; }
    table.tbrdr td { padding: 0.3rem 0.45rem; vertical-align: top; }
    td.ubrdr { border-top: 1px solid var(--line); font-weight: 600; background: var(--panel); }
    td.brdr { border-bottom: 1px solid var(--line); }
    td.crsheader { background: var(--panel-2); border-top: 1px solid var(--line); }
    table.tbrdr h2 { font-size: 1.05rem; margin: 0.25rem 0; }
    .boldtxt, .bold_text { font-weight: 600; }
    .icon.info { display: none; }
  </style>
</head>
<body>
  <div class="top">
    <h1>Results for ${safeQ}</h1>
    <p class="muted">Mode: ${escapeHtml(mode)} · Years back: ${years} · Terms searched: ${terms.map(escapeHtml).join(', ')}</p>
    <p>Found in ${foundCount} of ${results.length} quarters.</p>
    <p><a href="/">New search</a></p>
  </div>
  ${results
    .map(
      (result) => `
      <section class="term">
        <h2>${escapeHtml(result.term)}</h2>
        ${result.body}
      </section>`,
    )
    .join('\n')}
  <script>
    // Helpers referenced by onclick/href attributes in the UCSD result tables.
    function openNewWindow(url) { window.open(url, '_blank', 'noopener'); }
    function openNewTab(url) { window.open(url, '_blank', 'noopener'); }
    function sendMail(url) { window.open(url, '_blank', 'noopener'); }
  </script>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

// Client for UCSD Class Planner (https://classplanner.apps.ucsd.edu), which
// serves upcoming terms (FA26 onward) that the legacy act.ucsd.edu Schedule of
// Classes no longer returns.
//
// Class Planner is a JSON API. Two search routes have been seen in the wild:
//   /api/v1/public/catalog/courses/search   (unauthenticated)
//   /api/v1/catalog/courses/search          (older; may now need sign-in)
// We try the public route first and fall back to the older one.

export const CLASS_PLANNER_ORIGIN = 'https://classplanner.apps.ucsd.edu';

const SEARCH_URLS = [
  `${CLASS_PLANNER_ORIGIN}/api/v1/public/catalog/courses/search`,
  `${CLASS_PLANNER_ORIGIN}/api/v1/catalog/courses/search`,
];

// Server-enforced maximum; a larger limit is rejected with 422.
const PAGE_LIMIT = 48;
// Stop paging after this many pages so a broad query can't blow through the
// Worker's subrequest budget.
const MAX_PAGES = 5;

const USER_AGENT = 'ucsd-class-schedule-quickview (https://github.com/east-winds/ucsd-class-schedule-quickview)';

const SEASON_ORDER = { WI: 0, SP: 1, S1: 2, S2: 2, S3: 2, SU: 2, SA: 2, FA: 3 };

/** Sortable number for a term code like "WI27" (null if unrecognized). */
export function termOrdinal(term) {
  const m = /^([A-Z][A-Z0-9])(\d{2})$/.exec(String(term).toUpperCase());
  if (!m || !(m[1] in SEASON_ORDER)) return null;
  return Number(m[2]) * 4 + SEASON_ORDER[m[1]];
}

// The legacy act.ucsd.edu Schedule of Classes has no data from Fall 2026 on.
export const FIRST_CLASS_PLANNER_TERM = 'FA26';

/** Fetch this term from Class Planner (true) or legacy act.ucsd.edu (false)? */
export function usesClassPlanner(term) {
  const ord = termOrdinal(term);
  return ord !== null && ord >= termOrdinal(FIRST_CLASS_PLANNER_TERM);
}

export function createClassPlannerClient({ fetchImpl = fetch } = {}) {
  let workingUrl = null; // the search route that answered last

  async function call(init) {
    const order = workingUrl ? [workingUrl, ...SEARCH_URLS.filter((u) => u !== workingUrl)] : SEARCH_URLS;
    let lastError;
    for (const url of order) {
      let response;
      try {
        response = await fetchImpl(url, {
          ...init,
          headers: { accept: 'application/json', 'user-agent': USER_AGENT, ...(init?.headers || {}) },
          redirect: 'manual',
        });
      } catch (err) {
        lastError = new Error(`Class Planner request failed: ${err instanceof Error ? err.message : err}`);
        continue;
      }
      if (response.ok) {
        workingUrl = url;
        return response.json();
      }
      lastError = new Error(`Class Planner returned HTTP ${response.status}`);
      lastError.status = response.status;
      // Try the other route layout on auth/missing-route errors; anything else
      // (422 bad request, 5xx) is a real answer from the right endpoint.
      if (![401, 403, 404, 405].includes(response.status) && !(response.status >= 300 && response.status < 400)) {
        throw lastError;
      }
    }
    throw lastError;
  }

  async function searchAll(body) {
    const courses = [];
    let offset = 0;
    let total = Infinity;
    for (let page = 0; page < MAX_PAGES && offset < total; page += 1) {
      const result = await call({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...body, offset, limit: PAGE_LIMIT }),
      });
      const pageCourses = Array.isArray(result?.courses) ? result.courses : [];
      courses.push(...pageCourses);
      total = Number.isFinite(result?.total) ? result.total : courses.length;
      if (!pageCourses.length) break;
      offset += PAGE_LIMIT;
    }
    return { courses, truncated: courses.length < total };
  }

  /** Sections for a professor ("Last, First") or course ("GPPS 428") in a term. */
  async function search({ term, mode, query }) {
    if (mode === 'course') {
      const parsed = parseCourse(query);
      if (parsed) {
        const keys = [...new Set([`${parsed.subject} ${parsed.number}`, `${parsed.subject} ${padCourseNumber(parsed.number)}`])];
        const byKey = await searchAll(searchBody(term, { course_key: keys }));
        const matched = byKey.courses.filter((c) => courseMatches(c, parsed));
        if (matched.length) return { ...byKey, courses: matched };
      }
      // Fall back to a free-text search and keep exact course matches.
      const byText = await searchAll(searchBody(term, { q: query }));
      return {
        ...byText,
        courses: parsed ? byText.courses.filter((c) => courseMatches(c, parsed)) : byText.courses,
      };
    }

    const name = parseInstructor(query);
    // The instructor filter takes Class Planner's display names ("Michael Davidson").
    const attempts = [];
    if (name.first) attempts.push(searchBody(term, { instructor: [displayName(query)] }));
    attempts.push(searchBody(term, { q: query.split(',')[0].trim() }));
    let truncated = false;
    for (const body of attempts) {
      const result = await searchAll(body);
      truncated = truncated || result.truncated;
      const courses = filterByInstructor(result.courses, name);
      if (courses.length) return { courses, truncated: result.truncated };
    }
    return { courses: [], truncated };
  }

  return { search };
}

function searchBody(term, overrides) {
  return {
    term_code: term,
    q: '',
    subject_code: [],
    academic_level: [],
    instructor: [],
    instruction_type: [],
    availability: 'any',
    delivery: 'any',
    day_code: [],
    earliest_start: null,
    latest_end: null,
    sort: 'course_code',
    direction: 'asc',
    ...overrides,
  };
}

// "GPPS 428", "cse8a", "CSE 008A" -> { subject: "CSE", number: "8A" }
export function parseCourse(query) {
  const m = /^\s*([A-Za-z]{2,5})\s*-?\s*(\d+[A-Za-z]{0,3})\s*$/.exec(query);
  if (!m) return null;
  return { subject: m[1].toUpperCase(), number: stripLeadingZeros(m[2].toUpperCase()) };
}

function padCourseNumber(number) {
  const m = /^(\d+)(.*)$/.exec(number);
  return m ? `${m[1].padStart(3, '0')}${m[2]}` : number;
}

function stripLeadingZeros(number) {
  return String(number).replace(/^0+(?=\d)/, '');
}

/** Course number as UCSD prints it: "008A" or "CSE-008A" -> "8A". */
export function displayCourseNumber(course) {
  let code = String(course?.course_code ?? '');
  const subject = String(course?.subject_code ?? '');
  if (subject && code.toUpperCase().startsWith(subject.toUpperCase())) {
    code = code.slice(subject.length).replace(/^[\s-]+/, '');
  }
  return stripLeadingZeros(code.toUpperCase());
}

function courseMatches(course, parsed) {
  return (
    String(course?.subject_code ?? '').toUpperCase() === parsed.subject &&
    displayCourseNumber(course) === parsed.number
  );
}

// "Davidson, Michael" -> { last: "davidson", first: "michael" }
// "Michael Davidson"  -> { last: "davidson", first: "michael" }
export function parseInstructor(query) {
  const q = query.trim();
  if (q.includes(',')) {
    const [last, ...rest] = q.split(',');
    return { last: last.trim().toLowerCase(), first: (rest.join(' ').trim().split(/\s+/)[0] || '').toLowerCase() };
  }
  const parts = q.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { last: parts[0].toLowerCase(), first: '' };
  return { last: parts[parts.length - 1].toLowerCase(), first: parts[0].toLowerCase() };
}

// "Davidson, Michael" -> "Michael Davidson" (Class Planner's display order)
function displayName(query) {
  const q = query.trim();
  if (!q.includes(',')) return q;
  const [last, ...rest] = q.split(',');
  return `${rest.join(' ').trim()} ${last.trim()}`.trim();
}

function nameTokens(name) {
  return String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z']+/)
    .filter(Boolean);
}

/**
 * Does a Class Planner instructor name match the search? Class Planner uses
 * preferred display names ("Mike Davidson" or "Davidson, Michael"), so we
 * require the last name and, if given, a token sharing the first initial.
 */
export function instructorMatches(instructorName, { last, first }) {
  const tokens = nameTokens(instructorName);
  const lastTokens = nameTokens(last);
  if (!lastTokens.length) return false;
  const lastIdx = tokens.findIndex((t, i) => lastTokens.every((lt, j) => tokens[i + j] === lt));
  if (lastIdx === -1) return false;
  if (!first) return true;
  const initial = nameTokens(first)[0]?.[0];
  if (!initial) return true;
  return tokens.some((t, i) => (i < lastIdx || i >= lastIdx + lastTokens.length) && t.startsWith(initial));
}

/**
 * Keep courses taught by the instructor. For each course, keep the sections
 * they teach plus the sections those belong with (same section family, e.g.
 * the A00 lecture's A01 discussions), mirroring the legacy results table.
 */
export function filterByInstructor(courses, name) {
  const out = [];
  for (const course of courses) {
    const sections = Array.isArray(course.sections) ? course.sections : [];
    const taught = sections.filter((s) => (s.instructors || []).some((n) => instructorMatches(n, name)));
    const courseLevel = (course.instructors || []).some((n) => instructorMatches(n, name));
    if (!taught.length && !courseLevel) continue;
    if (!taught.length) {
      out.push(course);
      continue;
    }
    const families = new Set(taught.map(sectionFamily));
    out.push({ ...course, sections: sections.filter((s) => families.has(sectionFamily(s))) });
  }
  return out;
}

// "A00" / "A01" -> "A"; "001-000-LE" -> "001"
function sectionFamily(section) {
  const code = String(section?.section_code ?? '');
  const dashed = /^([^-]+)-/.exec(code);
  if (dashed) return dashed[1];
  const letter = /^([A-Z]+)\d/.exec(code);
  return letter ? letter[1] : code;
}

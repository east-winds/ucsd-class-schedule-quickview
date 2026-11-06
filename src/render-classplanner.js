import { CLASS_PLANNER_ORIGIN, displayCourseNumber } from './classplanner.js';
import { NO_RESULTS_HTML } from './extract.js';

const TYPE_ABBREVIATIONS = {
  lecture: 'LE',
  discussion: 'DI',
  laboratory: 'LA',
  lab: 'LA',
  seminar: 'SE',
  studio: 'ST',
  tutorial: 'TU',
  independent: 'IN',
  'independent study': 'IN',
  fieldwork: 'FW',
  'field work': 'FW',
  clinical: 'CL',
  practicum: 'PR',
  final: 'FI',
  'final exam': 'FI',
  midterm: 'MI',
  review: 'RE',
  'review session': 'RE',
};

const DAY_ORDER = ['M', 'T', 'W', 'R', 'F', 'S', 'U'];
const DAY_LETTER = {
  monday: 'M', tuesday: 'T', wednesday: 'W', thursday: 'R', friday: 'F', saturday: 'S', sunday: 'U',
  mon: 'M', tue: 'T', wed: 'W', thu: 'R', fri: 'F', sat: 'S', sun: 'U',
};

/** Link to the term in Class Planner, for the results page. */
export function classPlannerTermUrl(term) {
  return `${CLASS_PLANNER_ORIGIN}/workspace?term=${encodeURIComponent(term)}`;
}

/**
 * Render Class Planner courses as a results table styled like UCSD's legacy
 * table.tbrdr, so it shares the results page's CSS.
 */
export function renderClassPlannerCourses(courses) {
  if (!courses.length) return { found: false, html: NO_RESULTS_HTML };

  const rows = [];
  rows.push(
    '<tr>' +
      ['Course', 'Section', 'Type', 'Days', 'Time', 'Room', 'Instructor', 'Seats Available / Capacity', 'Waitlist']
        .map((h) => `<td class="ubrdr">${h}</td>`)
        .join('') +
      '</tr>',
  );

  for (const course of courses) {
    const code = `${course.subject_code ?? ''} ${displayCourseNumber(course)}`.trim();
    const title = course.course_title || course.module_name || '';
    const units = course.units_display ? ` (${course.units_display} Units)` : '';
    rows.push(
      `<tr><td class="crsheader" colspan="9"><span class="boldtxt">${esc(code)}</span> ${esc(title)}${esc(units)}</td></tr>`,
    );

    for (const section of course.sections || []) {
      const meetings = (section.meetings || []).filter(Boolean);
      const weekly = groupWeekly(meetings.filter((m) => !isExam(m)));
      const exams = meetings.filter(isExam);
      const type = typeOf(section);
      const instructors = (section.instructors || []).join('; ') || 'Staff';
      const seats = seatText(section);
      const waitlist = Number.isFinite(section.waitlist_enrolled) ? String(section.waitlist_enrolled) : '';
      const sectionLabel = section.section_code || section.section_ref || section.section_id || '';

      const first = weekly[0] || { days: 'TBA', time: 'TBA', room: 'TBA' };
      rows.push(
        '<tr>' +
          td('') +
          td(sectionLabel) +
          td(type) +
          td(first.days) +
          td(first.time) +
          td(first.room) +
          td(instructors) +
          td(seats) +
          td(waitlist) +
          '</tr>',
      );
      for (const extra of weekly.slice(1)) {
        rows.push('<tr>' + td('') + td('') + td(type) + td(extra.days) + td(extra.time) + td(extra.room) + td('') + td('') + td('') + '</tr>');
      }
      for (const exam of exams) {
        const label = exam.specific_date ? `${examType(exam)} ${exam.specific_date}` : examType(exam);
        rows.push(
          '<tr>' + td('') + td('') + td(label) + td(dayLetter(exam) || '') + td(timeText(exam)) + td(roomText(exam)) + td('') + td('') + td('') + '</tr>',
        );
      }
    }
  }

  return { found: true, html: `<table class="tbrdr">\n${rows.join('\n')}\n</table>` };
}

function td(text) {
  return `<td class="brdr">${esc(text)}</td>`;
}

function isExam(meeting) {
  const kind = String(meeting.meeting_kind || '').toLowerCase();
  return (kind && kind !== 'class') || (!!meeting.specific_date && !meeting.day_code);
}

function examType(meeting) {
  const kind = String(meeting.meeting_kind || '').toLowerCase();
  return TYPE_ABBREVIATIONS[kind] || (kind ? kind.toUpperCase() : 'EXAM');
}

function typeOf(section) {
  const suffix = /-([A-Z]{2})$/.exec(String(section.section_code || ''));
  if (suffix) return suffix[1];
  const name = String(section.instruction_type_name || '').toLowerCase();
  return TYPE_ABBREVIATIONS[name] || section.instruction_type_name || '';
}

function dayLetter(meeting) {
  if (meeting.day_code) return String(meeting.day_code).toUpperCase();
  return DAY_LETTER[String(meeting.day_name || '').toLowerCase()] || '';
}

function timeText(meeting) {
  if (meeting.is_tba) return 'TBA';
  const start = meeting.start_time_display;
  const end = meeting.end_time_display;
  if (start && end) return `${start}-${end}`;
  return start || end || 'TBA';
}

function roomText(meeting) {
  if (meeting.is_remote) return 'Remote';
  if (meeting.is_tba) return 'TBA';
  // room_code usually already includes the building ("GH 242").
  return meeting.room_code || meeting.building_code || 'TBA';
}

// Merge same-time, same-room weekly meetings into one row ("TR 9:30a-10:50a").
function groupWeekly(meetings) {
  const groups = new Map();
  for (const m of meetings) {
    const time = timeText(m);
    const room = roomText(m);
    const key = `${time}|${room}`;
    if (!groups.has(key)) groups.set(key, { days: [], time, room });
    const day = dayLetter(m);
    if (day && !groups.get(key).days.includes(day)) groups.get(key).days.push(day);
  }
  return [...groups.values()].map((g) => ({
    ...g,
    days: g.days.sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b)).join('') || 'TBA',
  }));
}

function seatText(section) {
  const available = section.seats_available;
  const capacity = section.capacity;
  if (Number.isFinite(available) && Number.isFinite(capacity)) {
    return available > 0 ? `${available} / ${capacity}` : `FULL / ${capacity}`;
  }
  if (Number.isFinite(capacity)) return `? / ${capacity}`;
  return '';
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

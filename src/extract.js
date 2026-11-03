export const UCSD_ORIGIN = 'https://act.ucsd.edu';

const RESULTS_TABLE_START = /<table\b[^>]*class="tbrdr"[^>]*>/i;
const NO_RESULTS_MARKER = /No Result Found/i;

export const NO_RESULTS_HTML = '<p class="no-results">No results found.</p>';
export const UNPARSEABLE_HTML =
  '<p class="no-results">Could not read the UCSD response (the page layout may have changed).</p>';

/**
 * Pull just the results table out of a UCSD Schedule of Classes result page.
 *
 * The upstream page is: "Your search was" box, a nav bar, the results table
 * (table.tbrdr), the nav bar again, inline scripts, and the site footer. Only
 * the results table is kept. When there are no results, UCSD shows a
 * "No Result Found" alert instead of the table.
 */
export function extractRelevantMarkup(sourceHtml) {
  if (!sourceHtml) return { found: false, html: UNPARSEABLE_HTML };

  const start = sourceHtml.search(RESULTS_TABLE_START);
  if (start !== -1) {
    const end = sourceHtml.indexOf('</table>', start);
    if (end !== -1) {
      const table = sourceHtml.slice(start, end + '</table>'.length);
      return { found: true, html: absolutizeLinks(table) };
    }
  }

  if (NO_RESULTS_MARKER.test(sourceHtml)) {
    return { found: false, html: NO_RESULTS_HTML };
  }

  return { found: false, html: UNPARSEABLE_HTML };
}

// Upstream links and images are root-relative (/scheduleOfClasses/..., /FacultyClasslist/...),
// which would resolve against the Worker's own domain. Point them back at UCSD.
function absolutizeLinks(markup) {
  return markup
    .replace(/((?:href|src)=)(["'])\/(?!\/)/gi, `$1$2${UCSD_ORIGIN}/`)
    .replace(/(openNewWindow\(|openNewTab\(|sendMail\()(["'])\/(?!\/)/g, `$1$2${UCSD_ORIGIN}/`);
}

#!/bin/bash
# Print only the results table from a saved UCSD Schedule of Classes result page.
# Drops the "Your search was" box, nav bars, scripts, and site footer.
# If the term has no results, prints a single "No results found." line.
#
# Usage: ./extract_results.sh page.html

SRC=$1

RESULTS=$(awk '/<table[^>]*class="tbrdr"/{f=1} f{print} f && /<\/table>/{exit}' "$SRC")

if [ -n "$RESULTS" ]; then
	echo "$RESULTS"
elif grep -q "No Result Found" "$SRC"; then
	echo '<p class="no-results">No results found.</p>'
else
	echo '<p class="no-results">Could not read the UCSD response (the page layout may have changed).</p>'
fi

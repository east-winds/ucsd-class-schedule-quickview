# UCSD Class Schedule Quickview

The [UCSD Schedule of Classes](https://act.ucsd.edu/scheduleOfClasses/scheduleOfClassesStudent.htm) is somewhat difficult to navigate. This repo allows you to quickly view UCSD course offered in current and previous X years by professor or course name.

## Cloud Usage

A Cloudflare Workers instance allows for web-based retrieval of results.

Visit: [**https://ucsd-classes.mrdavidson.workers.dev/**](https://ucsd-classes.mrdavidson.workers.dev/)

Example professor search: https://ucsd-classes.mrdavidson.workers.dev/api/search?mode=prof&q=Davidson%2C%20Michael&years=3

Example course search: https://ucsd-classes.mrdavidson.workers.dev/api/search?mode=course&q=GPPS%20428&years=3

Relevant links:
- `/` — search page
- `/api/search?mode=prof&q=Davidson,%20Michael&years=3`
- `/api/search?mode=course&q=GPPS%20428&years=3`
- Add `&format=json` for JSON output.
- `/healthz` — simple health endpoint


## Local Usage

Relevant files:
- `quickview_prof.sh`
- `quickview_coursename.sh`

Example usage (only tested for `bash` terminal):

```
./quickview_coursename.sh "GPPS 428"

./quickview_prof.sh "Davidson, Michael"

# Get last four years plus current year of results:
./quickview_prof.sh "Davidson, Michael" 4  
```

## Dev

### Local Development

```bash
npm install
npm run dev
```

### Deploy

```bash
npm install
npm run deploy
```

## Notes

This app still depends on UCSD's upstream schedule page structure and form fields. If UCSD changes them, the Worker may need updates.

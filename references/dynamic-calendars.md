# Dynamic calendar fallback: Queue-it + Algolia

Some venue calendars render almost no event data in the first HTML response. A common pattern is:

1. A Queue-it / waiting-room HTML shell that sets a test cookie and redirects via:
   `document.location.href = decodeURIComponent('...')`.
2. The real calendar page contains an Algolia InstantSearch container such as:
   `<div id="algoliaSearchCont" data-settings="...">`.
3. `data-settings` is URL-encoded JSON with public search settings: `appid`, `apikey`, `index`, and `hitsPerPage`.
4. Query Algolia directly using:
   - URL: `https://<appid>-dsn.algolia.net/1/indexes/<index>/query`
   - Headers: `X-Algolia-Application-Id`, `X-Algolia-API-Key`, `Content-Type: application/json`
   - Body: `{ "params": "query=&hitsPerPage=100&numericFilters=startDate>=...,..." }`
5. For event calendars, look for fields like `title`, `performanceDate`, `startDate` (Unix seconds), `venue`, `kenticoUrl`, `artists`, `conductors`, `composers`, and `works`.

Do not print public search keys in final answers or logs if avoidable. They are not private account secrets, but they are operational credentials and add noise.

SF Symphony example:

- Calendar URL: `https://www.sfsymphony.org/calendar`
- The page may first return Queue-it waiting-room markup.
- Follow the JavaScript redirect with the same cookie jar.
- The real page currently exposes Algolia settings for index `prod_sfs_calendar`.
- Filter by `startDate` Unix timestamps in America/Los_Angeles local time.

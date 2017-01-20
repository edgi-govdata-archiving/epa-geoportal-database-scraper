# EPA Geo Portal Database Scraper

Archives all ZIP files on http://gis.epa.ie/GetData/Download.

# Usage

Check out this repository. Then install the dependencies:

`yarn` or `npm install`

Head over to [Mailback](http://mailback.io) and create a new mailbox.

Then set the SCRAPER_MAILBACK_MAILBOX environment variable to the mailbox ID from above and run the index.js Node.js script:

`SCRAPER_MAILBACK_MAILBOX=##### node index`

If the scraping or downloading stalls, hit CTRL+C to quit and then restart the scraping. The tool is reentrant: it will check the existing manifest and continue scraping from where it has left off.

## Environment Variables

* SCRAPER_MAILBACK_MAILBOX - **Required.** Mailback mailbox ID.
* SCRAPER_INDEX_URL - The document index page URL. Overwrite for testing. Defaults to: http://gis.epa.ie/GetData/Download
* SCRAPER_DOWNLOAD_URL - The download request submit URL. Overwrite for testing. Defaults to: http://gis.epa.ie/getdata/downloaddata
* SCRAPER_MAX_DOCS - The maximum number of documents to request. Overwrite for testing. Defaults to nothing (i.e. request everything).
* SCRAPER_START_IDX - The starting index (zero-based). Overwrite for testing or retrying a particular file. Defaults to 0 (i.e. start from the beginning).
* SCRAPER_SKIP_DOWNLOAD - To skip downloading of the files and just scrape the download URLs. Set to any non-empty value (like "1"). Defaults to nothing (i.e. download ZIP files).

# Findings / Approach

The index page uses a navigation paradigm that shows radio buttons in chunks, but in fact all the radio buttons are present on the page. The script fetches the HTML and grabs the document IDs from the radio buttons on the page.

The download request form includes a CAPTCHA. but it turned out to be a pure-client-side check that can be completely bypassed by directly submitting the required fields to the target URL.

The "X-Requested-With" parameter (not HTTP header) somehow needed to be submitted along with the other fields.

# How It Works

1. Fetches the index page and extracts all document IDs
2. Submits the download request form for each document ID while using a Mailback mailbox email address
3. Fetches the HTML content of the email from Mailback
4. Extracts the first link in the HTML (it points to a ZIP file)
5. Downloads the ZIP file (can be opted out)
6. Saves the ZIP file under the archive folder (can be opted out)
7. Updates manifest.json file under the archive folder

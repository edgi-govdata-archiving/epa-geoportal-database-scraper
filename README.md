# EPA Geo Portal Database Scraper

Scrapes all the document IDs on http://gis.epa.ie/GetData/Download and submits requests for download links to be emailed to a specified email address.

# Usage

Check out this repository.

Then install the dependencies:

`yarn` or `npm install`

Then set the SCRAPER_EMAIL environment variable to the recipient email address and run the index.js Node.js script:

`SCRAPER_EMAIL=joe@example.com node index`

## Environment Variables

* SCRAPER_INDEX_URL - The document index page URL. Overwrite for testing. Defaults to: http://gis.epa.ie/GetData/Download
* SCRAPER_DOWNLOAD_URL - The download request submit URL. Overwrite for testing. Defaults to: http://gis.epa.ie/getdata/downloaddata
* SCRAPER_MAX_DOCS - The maximum number of documents to request. Overwrite for testing. Defaults to nothing (i.e. request everything).
* SCRAPER_EMAIL - The recipient email address. Must be set.

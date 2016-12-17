const rp = require('request-promise-native');
const cheerio = require('cheerio');

const config = {
  indexUrl: process.env.SCRAPER_INDEX_URL || 'http://gis.epa.ie/GetData/Download',
  downloadUrl: process.env.SCRAPER_DOWNLOAD_URL || 'http://gis.epa.ie/getdata/downloaddata',
  email: process.env.SCRAPER_EMAIL,
  maxDocs: parseInt(process.env.SCRAPER_MAX_DOCS, 10) || Infinity
};

function enqueue(items, promiseFactory) {
  if (!items.length) {
    return Promise.resolve();
  } else {
    return promiseFactory(items[0])
      .then(() => enqueue(items.slice(1), promiseFactory));
  }
}

function getIdList() {
  return rp(config.indexUrl)
    .then(html => {
      const $ = cheerio.load(html);

      return $('.SelectedFile')
        .map((idx, el) => {
          const id = $(el).val();
          return id;
        })
        .get();
    })
    .catch(error => {
      console.error('Fetch failed', error);
    });
}

getIdList()
  .then(idList => {
    console.log(`Got ${idList.length} IDs`);

    return enqueue(idList.slice(0, config.maxDocs), id => {
      const options = {
        uri: config.downloadUrl,
        method: 'POST',
        form: {
          SelectedFile: id,
          Email: config.email,
          reEmail: config.email,
          'X-Requested-With': 'XMLHttpRequest'
        }
      };

      return rp(options)
        .then(response => {
          console.log(`Submitted request for ID ${id}`)
        })
        .catch(error => {
          console.error('Fetch failed', error);
        });
    });
  })
  .catch(console.error);

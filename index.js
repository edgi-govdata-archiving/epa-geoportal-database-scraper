const fs = require('fs');
const path = require('path');

const rp = require('request-promise-native');
const cheerio = require('cheerio');
const yauzl = require('yauzl');
const mkdirp = require('mkdirp');

const config = {
  indexUrl: process.env.SCRAPER_INDEX_URL || 'http://gis.epa.ie/GetData/Download',
  downloadUrl: process.env.SCRAPER_DOWNLOAD_URL || 'http://gis.epa.ie/getdata/downloaddata',
  mailbackMailbox: process.env.SCRAPER_MAILBACK_MAILBOX,
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

    const email = config.mailbackMailbox + '@mail.mailback.io';

    return enqueue(idList.slice(0, config.maxDocs), id => {
      const options = {
        uri: config.downloadUrl,
        method: 'POST',
        form: {
          SelectedFile: id,
          Email: email,
          reEmail: email,
          'X-Requested-With': 'XMLHttpRequest'
        }
      };

      return rp(options)
        .then(response => {
          console.log(`Submitted request for ID ${id}`)

          const options = {
            uri: `http://mailback.io/go/${config.mailbackMailbox}`,
            encoding: null
          };

          return rp(options);
        })
        .then(zipData => {
          console.log('Got response from Mailback');

          return new Promise((resolve, reject) => {
            const options = {
              lazyEntries: true
            };

            yauzl.fromBuffer(Buffer.from(zipData), options, (err, zipFile) => {
              if (err) {
                return reject(err);
              }

              resolve(zipFile);
            });
          });
        })
        .then(zipFile => {
          console.log('Got zip file');

          return new Promise((resolve, reject) => {
            zipFile.on('entry', entry => {
              const fullPath = path.join(__dirname, 'archive', id, entry.fileName);

              if (/\/$/.test(entry.fileName)) {
                mkdirp(fullPath, error => {
                  if (error) {
                    reject(error);
                  } else {
                    zipFile.readEntry();
                  }
                });
              } else {
                zipFile.openReadStream(entry, (error, readStream) => {
                  if (error) {
                    reject(error);
                  } else {
                    mkdirp(path.dirname(fullPath), error => {
                      if (error) {
                        reject(error);
                      } else {
                        readStream.pipe(fs.createWriteStream(fullPath));
                        readStream.on('end', () => {
                          zipFile.readEntry();
                        });
                      }
                    });
                  }
                });
              }
            });

            zipFile.on('end', resolve);

            zipFile.readEntry();
          });
        })
        .then(() => {
          console.log('Unpacked');
        })
        .catch(error => {
          console.error('Error', error);
        });
    });
  })
  .catch(console.error);

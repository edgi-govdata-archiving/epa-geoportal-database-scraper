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

Promise.resolve()
  .then(() => {
    console.log('Fetching index HTML');

    return rp(config.indexUrl);
  })
  .then(html => {
    console.log('Extracting file metadata');

    const $ = cheerio.load(html);

    return $('.SelectedFile')
      .map((idx, el) => {
        const id = $(el).val();

        return {
          id
        };
      })
      .get();
  })
  .then(fileList => {
    console.log(`Found ${fileList.length} files`);

    const email = config.mailbackMailbox + '@mail.mailback.io';

    return enqueue(fileList.slice(0, config.maxDocs), file => {
      const options = {
        uri: config.downloadUrl,
        method: 'POST',
        form: {
          SelectedFile: file.id,
          Email: email,
          reEmail: email,
          'X-Requested-With': 'XMLHttpRequest'
        }
      };

      console.log(`Requesting file ${file.id}`);

      return rp(options)
        .then(response => {
          console.log('File requested');

          const options = {
            uri: `http://mailback.io/go/${config.mailbackMailbox}`,
            encoding: null
          };

          return rp(options);
        })
        .then(zipData => {
          console.log('File received');

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
          console.log('Unpacking file');

          return new Promise((resolve, reject) => {
            zipFile.on('entry', entry => {
              const fullPath = path.join(__dirname, 'archive', file.id, entry.fileName);

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
          console.log('Unpacking done');
        })
        .catch(error => {
          console.error('Error', error);
        });
    });
  })
  .catch(console.error);

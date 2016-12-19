const fs = require('fs');
const path = require('path');

const rp = require('request-promise-native');
const cheerio = require('cheerio');
const yauzl = require('yauzl');
const mkdirp = require('mkdirp');

const enqueue = require('./enqueue');

const config = {
  indexUrl: process.env.SCRAPER_INDEX_URL || 'http://gis.epa.ie/GetData/Download',
  downloadUrl: process.env.SCRAPER_DOWNLOAD_URL || 'http://gis.epa.ie/getdata/downloaddata',
  mailbackMailbox: process.env.SCRAPER_MAILBACK_MAILBOX,
  maxDocs: parseInt(process.env.SCRAPER_MAX_DOCS, 10) || Infinity
};

function openZipFile(zipData) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(Buffer.from(zipData), { lazyEntries: true }, (err, zipFile) => {
      if (err) {
        reject(err);
      } else {
        resolve(zipFile);
      }
    });
  });
}

function unpackZipFile(zipFile, destinationDirectory) {
  return new Promise((resolve, reject) => {
    zipFile.on('entry', entry => {
      const fullPath = path.join(destinationDirectory, entry.fileName);

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
}

function archiveFile(file) {
  return Promise.resolve()
    .then(() => {
      console.log(`Archiving file ${file.id} (${file.category.name}/${file.name})`);

      const email = config.mailbackMailbox + '@mail.mailback.io';

      return rp({
        uri: config.downloadUrl,
        method: 'POST',
        form: {
          SelectedFile: file.id,
          Email: email,
          reEmail: email,
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
    })
    .then(() => {
      console.log('File requested');

      return rp({
        uri: `http://mailback.io/go/${config.mailbackMailbox}`,
        encoding: null
      });
    })
    .then(zipData => {
      console.log('File received');

      return openZipFile(zipData);
    })
    .then(zipFile => {
      console.log('Unpacking file');

      return unpackZipFile(zipFile, path.join(__dirname, 'archive', file.id));
    })
    .then(() => {
      console.log('Unpacking done');
    });
}

Promise.resolve()
  .then(() => {
    console.log('Fetching index HTML');

    return rp(config.indexUrl);
  })
  .then(html => {
    console.log('Extracting file metadata');

    const $ = cheerio.load(html);

    const categoryList = $('.categories h3')
      .map((idx, el) => {
        const $el = $(el);

        return {
          id: $el.attr('class').replace(/\D/g, ''),
          name: $el.text()
        };
      })
      .get();

    const categoryMap = {};

    categoryList.forEach(category => {
      categoryMap[category.id] = category;
    });

    return $('.SelectedFile')
      .map((idx, el) => {
        const $el = $(el);

        const categoryId = $el.closest('p').attr('class').replace(/\D/g, '');

        return {
          id: $el.val(),
          category: categoryMap[categoryId],
          name: $el.parent().text()
        };
      })
      .get();
  })
  .then(fileList => {
    console.log(`Found ${fileList.length} file(s)`);

    const filesToArchive = Math.min(fileList.length, config.maxDocs);

    console.log(`Archiving ${filesToArchive} file(s)`);

    return enqueue(fileList.slice(0, filesToArchive), archiveFile)
  })
  .then(() => {
    console.log('All files archived!');
  })
  .catch(console.error);

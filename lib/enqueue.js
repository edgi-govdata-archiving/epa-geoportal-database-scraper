function enqueue(items, promiseFactory, results) {
  results = results || [];
  
  if (!items.length) {
    return Promise.resolve(results);
  } else {
    return promiseFactory(items[0])
      .then((result) => enqueue(items.slice(1), promiseFactory, results.concat(result));
  }
}

module.exports = enqueue;

function enqueue(items, promiseFactory) {
  if (!items.length) {
    return Promise.resolve();
  } else {
    return promiseFactory(items[0])
      .then(() => enqueue(items.slice(1), promiseFactory))
      .then(() => items);
  }
}

module.exports = enqueue;

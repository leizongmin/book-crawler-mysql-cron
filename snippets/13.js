process.on('uncaughtException', function (err) {
  console.error('uncaughtException: %s', err.stack);
})

throw new Error();

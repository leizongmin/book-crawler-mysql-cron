var async = require('async');

async.series([
  function (done) {
    console.log(1);
    done();
  },
  function (done) {
    console.log(2);
    done(new Error('error'));
  },
  function (done) {
    console.log(3);
    done();
  }
], function (err) {
  if (err) throw err;

  console.log('完成');
});

var request = require('request');
var cheerio = require('cheerio');

request('http://www.taobao.com/', function (err, res, body) {
  if (err) throw err;

  var $ = cheerio.load(body);

  console.log($('head title').text());
});

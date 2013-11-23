var request = require('request');
var cheerio = require('cheerio');
var iconv = require('iconv-lite');

request({
  url:      'http://www.taobao.com/',
  encoding: null
}, function (err, res, body) {
  if (err) throw err;

  body = iconv.decode(body, 'gbk');

  var $ = cheerio.load(body);

  console.log($('head title').text());
});

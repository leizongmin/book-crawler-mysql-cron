var cheerio = require('cheerio');
var gbk = require('gbk');

gbk.fetch('http://www.taobao.com/','utf-8').to('string', function (err, body) {
  if (err) throw err;

  var $ = cheerio.load(body);

  // 输出网页标题
  console.log($('head title').text());
});
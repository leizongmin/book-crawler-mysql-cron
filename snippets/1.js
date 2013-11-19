var request = require('request');
var cheerio = require('cheerio');
var debug = require('debug')('blog:update');

debug('读取博文类别列表');

// 读取博客首页
request('http://blog.sina.com.cn/u/1776757314', function (err, res) {
  if (err) return console.error(err);

  // 根据网页内容创建DOM操作对象
  var $ = cheerio.load(res.body.toString());

  // 读取博文类别列表
  var classList = [];
  $('.classList li a').each(function () {
    var $me = $(this);
    var item = {
      name: $me.text().trim(),
      url:  $me.attr('href')
    };
    // 从URL中取出分类的ID
    var s = item.url.match(/articlelist_\d+_(\d+)_\d\.html/);
    if (Array.isArray(s)) {
      item.id = s[1];
      classList.push(item);
    }
  });

  // 输出结果
  console.log(classList);
});
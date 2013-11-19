var request = require('request');
var cheerio = require('cheerio');
var debug = require('debug')('blog:update');

debug('读取博文内容');

// 读取博文页面
request('http://blog.sina.com.cn/s/blog_69e72a420101gvec.html', function (err, res) {
  if (err) return callback(err);

  // 根据网页内容创建DOM操作对象
  var $ = cheerio.load(res.body.toString());

  // 获取文章标签
  var tags = [];
  $('.blog_tag h3 a').each(function () {
    var tag = $(this).text().trim();
    if (tag) {
      tags.push(tag);
    }
  });

  // 获取文章内容
  var content = $('.articalContent').html().trim();

  // 输出结果
  console.log({tags: tags, content: content});
});
var request = require('request');
var cheerio = require('cheerio');
var mysql = require('mysql');
var debug = require('debug')('blog:update');

// 创建数据库连接
var db = mysql.createConnection({
  host:     '127.0.0.1',   // 数据库IP
  port:     3306,          // 数据库端口
  database: 'sina_blog',   // 数据库名称
  user:     'root',        // 数据库用户名
  password: '',            // 数据库密码
});

// 显示所有数据表
db.query('show tables', function (err, tables) {
  if (err) {
    console.error(err.stack);
  } else {
    console.log(tables);
  }

  // 关闭连接
  db.end();
});

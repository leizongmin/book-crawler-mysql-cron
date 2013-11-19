var async = require('async');
var config = require('../config');
var read = require('./read');
var save = require('./save');
var debug = require('debug')('blog:update:all');


var classList;
var articleList = {};

async.series([

  // 获取文章分类列表
  function (done) {
    read.classList(config.sinaBlog.url, function (err, list) {
      classList = list;
      done(err);
    });
  },

  // 保存文章分类
  function (done) {
    save.classList(classList, done)
  },

  // 依次获取所有文章分类下的文章列表
  function (done) {
    async.eachSeries(classList, function (c, next) {
      read.articleList(c.url, function (err, list) {
        articleList[c.id] = list;
        next(err);
      });

    }, done);
  },

  // 保存文章列表
  function (done) {
    async.eachSeries(Object.keys(articleList), function (classId, next) {
      save.articleList(classId, articleList[classId], next);
    }, done);
  },

  // 保存文章数量
  function (done) {
    async.eachSeries(Object.keys(articleList), function (classId, next) {
      save.articleCount(classId, articleList[classId].length, next);
    }, done);
  },

  // 重新整理文章列表，把重复的文章去掉
  function (done) {
    debug('整理文章列表，把重复的文章去掉');

    var articles = {};
    Object.keys(articleList).forEach(function (classId) {
      articleList[classId].forEach(function (item) {
        articles[item.id] = item;
      });
    });

    articleList = [];
    Object.keys(articles).forEach(function (id) {
      articleList.push(articles[id]);
    });

    done();
  },

  // 依次读取文章的详细内容，并保存
  function (done) {
    async.eachSeries(articleList, function (item, next) {
      save.isAericleExists(item.id, function (err, exists) {
        if (err) return next(err);

        if (exists) {
          debug('文章已存在：%s', item.url);
          return next();
        }

        read.articleDetail(item.url, function (err, ret) {
          if (err) return next(err);
          save.articleDetail(item.id, ret.tags, ret.content, function (err) {
            if (err) return next(err);
            save.articleTags(item.id, ret.tags, next);
          });
        });
      });
    }, done);
  }

], function (err) {
  if (err) console.error(err.stack);

  console.log('完成');
  process.exit(0);
});
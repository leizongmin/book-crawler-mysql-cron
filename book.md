网络爬虫与数据库操作
===========

## 简介

本章将通过一个实例来介绍如何编写一个网络爬虫程序来抓取网页内容，并存储到 MySQL
数据库中，以及定期执行爬虫来更新内容。通过本章内容的学习，读者将掌握以下技能：

+ 发起一个 HTTP 请求来获取指定 URL 的内容；
+ 使用 jQuery 的查询语法来操作网页元素，提取出需要的数据；
+ 将数据储存到数据库中，以及从数据库中查询出这些数据；
+ 建立一个简单的 Web 服务器来显示这些数据；
+ 使用简单的方法来让一些程序在指定的时间自动执行；
+ 让程序更稳定地运行；
+ 对一些常见的字符编码互相转换。


### 学习目标

下面是本实例完成后的程序的截图：

![博客程序首页][1]

![博客程序文章页面][2]

在开始本实例的学习前，你需要具备以下的基础知识：

+ 会运行 Node.js 写的程序，能通过 npm 工具来安装相关的依赖模块；
+ 对 HTML 有所了解，会使用 jQuery 来操作网页 DOM；
+ 使用过 MySQL 数据库。


## 网络爬虫

网络爬虫是一种自动获取网页内容的程序。在本实例中，我们需要通过一个爬虫程序来抓取
到源网页的内容，并从中提取出需要的数据。在此过程中，会涉及到如何获取到网页的内容
、如何从网页中获取所需要的数据、以及如何将数据储存到数据库中。由于网络 I/O 操作
大都是异步的，因此还会提到如何进行简单异步流程控制。


### 相关模块介绍

#### 使用 request 模块来获取网页内容

**request** 是一个用来简化 HTTP 请求操作的模块，其功能强大而且使用方法简单，以下
是一个通过 GET 方法来获取某个URL的内容的例子：

```JavaScript
var request = require('request');

// 通过 GET 请求来读取 http://cnodejs.org/ 的内容
request('http://cnodejs.org/', function (error, response, body) {
  if (!error && response.statusCode == 200) {
    // 输出网页内容
    console.log(body);
  }
});
```

如果是其他的请求方法，或者需要指定请求头等信息，可以在第一个参数中传入一个对象来
指定，比如：

```JavaScript
var request = require('request');

request({
  url:    'http://cnodejs.org/',   // 请求的URL
  method: 'GET',                   // 请求方法
  headers: {                       // 指定请求头
    'Accept-Language': 'zh-CN,zh;q=0.8',         // 指定 Accept-Language
    'Cookie': '__utma=4454.11221.455353.21.143;' // 指定 Cookie
  }
}, function (error, response, body) {
  if (!error && response.statusCode == 200) {
    console.log(body) // 输出网页内容
  }
});
```

由于本实例中仅用到了 request 模块很少的部分，其具体的使用方法在此不再赘述，感兴
趣的读者可以浏览该模块的主页来获取详细的使用说明：
https://npmjs.org/package/request


#### 使用 cheerio 模块来提取网页中的数据

**cheerio** 是一个 jQuery Core 的子集，其实现了 jQuery Core 中浏览器无关的 DOM
操作 API，以下是一个简单的示例：

```JavaScript
var cheerio = require('cheerio');

// 通过 load 方法把 HTML 代码转换成一个 jQuery 对象
var $ = cheerio.load('<h2 class="title">Hello world</h2>');

// 可以使用与 jQuery 一样的语法来操作
$('h2.title').text('Hello there!');
$('h2').addClass('welcome');

console.log($.html());
// 将输出 <h2 class="title welcome">Hello there!</h2>
```

需要注意的是，cheerio 并不支持所有 jQuery 的查询语法，比如 `$('a:first')` 会报错
，只能写成 `$('a').first()` ，在使用的时候需要注意。

**cheerio** 模块的详细使用方法可以访问该模块的主要来获取：
https://npmjs.org/package/cheerio


#### 使用 mysql 模块来将数据储存到数据库

**mysql** 是 Node.js 下比较有名的一个 MySQL 操作模块，在本实例中我们将通过此模块
来将结果保存到数据库中。以下是一个简单的示例：

```JavaScript
var mysql = require('mysql');

// 创建数据库连接
var connection = mysql.createConnection({
  host:     'localhost',
  user:     'me',
  password: 'secret',
});
connection.connect();

// 执行查询
connection.query('SELECT 1 + 1 AS solution', function(err, rows) {
  if (err) throw err;

  console.log('The solution is: ' + rows[0].solution);

  // 关闭连接
  connection.end();
});
```

如果执行的是更新语句，比如 `UPDATE`、`DELETE`、`INSERT`，我们可以从回调函数的第
二个参数中获取到对应的执行结果，比如：

```JavaScript
connection.query('UPDATE `table` SET `a`=1', function (err, info) {
  if (err) throw err;

  // UPDATE 和 DELETE 可以通过 info.affectedRows 来获取到受影响的行数
  console.log('受影响的行数：' + info.affectedRows);
});

connection.query('INSERT INTO `table`(`a`) VALUES (1)', function (err, info) {
  if (err) throw err;

  // INSERT 可以通过 info.insertId 来获取到当前记录的自增 ID
  console.log('ID：' + info.insertId);
});
```

##### MySQL 服务器断开连接

当遇到网络问题，或者 MySQL 服务器重启，或者因为超过一段时间没有操作时，MySQL
服务器会主动断开连接，这时候会触发一个 `error` 事件。为了保证程序能正常工作，我
们需要监听这个事件，并重新连接数据库。以下是来自 mysql 模块使用手册中的例子：

```JavaScript
var db_config = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'example'
};

var connection;

function handleDisconnect() {

  // 当旧的连接不能再使用时，创建一个新的连接
  connection = mysql.createConnection(db_config);
  connection.connect(function(err) {
    // 当连接成功或失败时，会调用此回调函数
    // 如果 err 为非空，则说明连接失败，err 是对应的出错信息
    if(err) {
      console.log('连接到数据库时出错: ' + err);
      // 为了避免死循环，需要等待一段时间后再重试
      setTimeout(handleDisconnect, 2000);
    }
  });

  connection.on('error', function(err) {
    // 在使用过程中出错，会触发 error 事件
    console.log('出错: ' + err);
    if(err.code === 'PROTOCOL_CONNECTION_LOST') {
      // 如果是 “丢失连接” 错误，则重新连接
      handleDisconnect();
    } else {
      throw err;
    }
  });
}

handleDisconnect();
```

##### 字符串值的转义

在使用客户端输入的值来组装 SQL 查询语句时，我们需要对这些值进行正确的转义，以避
免遭受 SQL 注入攻击。我们可以使用 `escape()` 方法来对这些值进行转义：

```JavaScript
var userId = ' 这是用户输入的数据';
var sql = 'SELECT * FROM users WHERE id = ' + connection.escape(userId);
connection.query(sql, function(err, results) {
  // ...
});
```

另外，还可以在 SQL 语句中将要转义的值用问号 `?`来代替，再在调用 `query()` 方法时
传入这些待转义的值：

```JavaScript
// 第二个参数是一个数组，分别对应 SQL 语句中各个 ? 部分的值
connection.query('SELECT * FROM users WHERE a = ? AND b = ?', [a, b], function(err, results) {
  // ...
});
```


##### 标识符的转义

与字符串值的转义类似，标识符的转义可以使用 `escapeId()` 方法来实现：

```JavaScript
var sorter = 'date';
var query = 'SELECT * FROM posts ORDER BY ' + mysql.escapeId(sorter);
console.log(query); // SELECT * FROM posts ORDER BY `date`
```

```JavaScript
var sorter = 'date';
var query = 'SELECT * FROM posts ORDER BY ' + mysql.escapeId('posts.' + sorter);

console.log(query); // SELECT * FROM posts ORDER BY `posts`.`date`
```

我们也可以在 SQL 语句中使用两个问号 `??` 来表示要转义的标识符：

```JavaScript
var userId = 1;
var columns = ['username', 'email'];
var query = connection.query('SELECT ?? FROM ?? WHERE id = ?', [columns, 'users', userId], function(err, results) {
  // ...
});

console.log(query.sql); // SELECT `username`, `email` FROM `users` WHERE id = 1
```


##### 连接池

在实际应用中，往往需要同时发起多个数据库查询，若仅有一个数据库连接，则只能把这些
查询放到等待队列中，会一定程度上影响程序的运行效率。因此，我们需要一个连接池来管
理多个数据库连接。

**mysql** 模块内置了连接池机制，以下是一个简单的使用示例：

```JavaScript
var mysql = require('mysql');

// 创建数据库连接池
var pool  = mysql.createPool({
  host:           'localhost', // 数据库地址
  user:           'root',      // 数据库用户
  password:        '',         // 对应的密码
  database:        'example',  // 数据库名称
  connectionLimit: 10          // 最大连接数，默认为10
});

// 在使用 SQL 查询前，需要调用 pool.getConnection() 来取得一个连接
pool.getConnection(function(err, connection) {
  if (err) throw err;

  // connection 即为当前一个可用的数据库连接
});
```

**mysql** 模块具体的使用方法将在后面的实例中说明，有兴趣的读者也可以访问该模块的
主页来获取详细使用说明：https://github.com/felixge/node-mysql


#### 使用 async 模块来简化异步流程控制

**async** 是一个使用比较广泛的 JavaScript 异步流程控制模块，除了可以在 Node.js
上运行外，其还可以在浏览器端运行。 **async** 模块提供了约 20 多个实用的函数来
帮助我们理清在使用 Node.js 过程中各种复杂回调。以下简单介绍其中一些常用的函数：

##### 串行地执行一组函数

可以使用 `async.series()` 来依次执行一组函数，其第一个参数是一个函数数组，每个函
数接受一个参数作为其回调函数，在该函数执行完成时调用回调函数即可。
`async.series()` 的第二个参数作为整一组函数执行完成后的回调函数。以下是其简单的
使用示例：

```JavaScript
var async = require('async');

async.series([
  function (done) {
    console.log(1);
    done();
  },
  function (done) {
    console.log(2);
    done();
  },
  function (done) {
    console.log(3);
    done();
  }
], function (err) {
  if (err) throw err;

  console.log('完成');
});
```

执行以上的程序，将会输出以下结果：

```
1
2
3
完成
```

如果在执行某一个函数的过程中出错了，可以在执行回调函数 `done()` 的时候，将出错信
息作为回调函数的第一个参数并执行，程序将会跳过函数数组中剩余的部分而直接执行最终
的回调函数，比如：

```JavaScript
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
```

执行以上的程序，可以看到在输出 `1` 和 `2` 之后，程序即抛出了一个异常信息并终止
了。

如果要并行的执行一组函数，我们只需要使用 `async.parallel()` 即可，其使用方法与
`async.series()` 一样。


##### 遍历数组，将数组中的每个元素作为参数执行异步任务

如果要遍历一个数组，可能我们会这样写：

```JavaScript
var arr = [1, 2, 3, 4, 5];
arr.forEach(function (item) {
  console.log(item);
});
```

假如 `forEach()` 的回调函数内部要执行的是一些异步操作，而我们又需要等待遍历操作
完成后再执行其他的操作，可以使用 `async.each()` 来实现：

```JavaScript
var async = require('async');

var arr = [1, 2, 3, 4, 5];
async.each(arr, function (item, done) {

  // 通过 setTimeout 来模拟一个异步任务
  setTimeout(function () {
    console.log(item);
    done();
  }, Math.random() * 1000);

}, function (err) {
  if (err) throw err;

  console.log('完成');
});
```

运行以上程序，可能会输出以下结果：

```
4
2
3
5
1
完成
```

其中数字部分的数序是随机的，再输出完这些 1 至 5 这几个数字后，最后输出“完成”。
这是因为这些异步任务都是并行执行的，待所有任务都调用 `done()` 来返回后，才
执行最终的回调函数。如果要让这些异步任务串行执行，可以使用 `async.eachSeries()`
来实现。

对应于数组的 `map`、`filter`、`reduce` 等方法， **async** 模块也提供了相应工具
函数。关于 async 模块的详细使用方法可以访问该模块的主页来获取：
https://npmjs.org/package/async

另外，读者可以阅读本章末尾的“参考文献”部分的《Async详解》系列文章，其对 async
模块进行了非常详细的讲解。


#### 使用 debug 模块来显示调试信息

在编写程序的时候，有时候我们需要输出一些调试信息，以便排查问题。当程序在生产
环境中运行的时候，我们又不需要输出这些调试信息。为了方便切换而不需要改动原来的程
序，我们可以使用 debug 模块，在启动程序的时候按照说明来设置一下 **debug** 环境变
量即可。以下是其简单的使用方法：

```JavaScript
var debug = require('debug')('myapp:main');

debug('现在的时间是 %s', new Date());
```

如果我们需要在程序运行的时候输出调试信息，只需要设置环境变量 `debug=myapp:*` 即
可。读者可以访问该模块的主页来获取详细的使用说明：
https://npmjs.org/package/debug


### 创建网络爬虫前的准备工作

在开始写程序前，我们需要做一些初始化工作，比如建立一个 package.json 文件，指定
模块依赖关系，这样可以方便以后部署应用。

+ 首先，新建一个文件夹，比如 `blog` ，本实例中的所有程序程序将放在此目录内（下文
  所指的“ **应用根目录** ”即表示在此目录下的一级目录，不再说明）；
+ 在应用根目录下建立一个文件 `package.json` ，其内容如下：

```JSON
{
  "name":           "sina-blog-proxy",
  "main":           "app.js",
  "version":        "0.0.1",
  "private":        true,
  "description":    "网络爬虫与数据库操作",
  "engines": {
    "node":         ">= 0.10.0"
  },
  "dependencies": {
    "debug":        "0.7.2",
    "cheerio":      "0.12.3",
    "request":      "2.27.0",
    "async":        "0.2.9",
    "mysql":        "2.x"
  }
}
```

+ 在应用根目录下新建目录 `update` ，本实例中的爬虫程序将保存在此目录下；
+ 在应用根目录下执行命令 `npm install` 来安装所有的依赖模块。

在完成以上的初始化工作之后，我们就可以开始编写爬虫程序了。本实例将以这个新浪博客
页面为例：http://blog.sina.com.cn/u/1776757314

![示例新浪博客主页][3]


### 获取文章分类列表

首先，我们需要读取文章的分类列表，然后再逐个把这些分类下的文章抓取下来。这个博客
的文章分类在左侧边栏：

![示例新浪博客侧边栏的文章分类列表][4]

相关部分的 HTML 代码如下：

```HTML
<div class="classList">
  <ul>
    <li class="SG_dot"><a target="_blank" href="http://blog.sina.com.cn/s/articlelist_1776757314_0_1.html">全部博文</a>
      <em class="count SG_txtb">(131)</em>
    </li>
    <li class="SG_dot"><a href="http://blog.sina.com.cn/s/articlelist_1776757314_1_1.html" target="_blank">祖国大陆~</a>
      <em>(30)</em>
    </li>
    <li class="SG_dot"><a href="http://blog.sina.com.cn/s/articlelist_1776757314_4_1.html" target="_blank">纵贯台湾岛~</a>
      <em>(37)</em>
    </li>
    <li class="SG_dot"><a href="http://blog.sina.com.cn/s/articlelist_1776757314_5_1.html" target="_blank">港澳行记~</a>
      <em>(13)</em>
    </li>
    <li class="SG_dot"><a href="http://blog.sina.com.cn/s/articlelist_1776757314_6_1.html" target="_blank">缤纷东南亚~</a>
      <em>(19)</em>
    </li>
    <li class="SG_dot"><a href="http://blog.sina.com.cn/s/articlelist_1776757314_7_1.html" target="_blank">澳大利亚~</a>
      <em>(0)</em>
    </li>
    <li class="SG_dot"><a href="http://blog.sina.com.cn/s/articlelist_1776757314_8_1.html" target="_blank">日本~</a>
      <em>(0)</em>
    </li>
    <li class="SG_dot"><a href="http://blog.sina.com.cn/s/articlelist_1776757314_9_1.html" target="_blank">美国~</a>
      <em>(0)</em>
    </li>
    <li class="SG_dot"><a href="http://blog.sina.com.cn/s/articlelist_1776757314_2_1.html" target="_blank">MY烘焙生活~</a>
      <em>(11)</em>
    </li>
    <li class="SG_dot"><a href="http://blog.sina.com.cn/s/articlelist_1776757314_3_1.html" target="_blank">小日子~</a>
      <em>(21)</em>
    </li>
  </ul>
</div>
```

我们需要从这段 HTML 中获取到分类的名称、URL 和 ID，如果熟悉 jQuery 的使用方法的
话，我们很容易想到，通过 `$('.classList li a')` 来获取到所有分类的 a 标签，然后
再从中提取出名称和URL，分类的 ID 存在 URL 中，需要用正则匹配来取得。

新建文件 `class_list.js` ，保存到应用根目录下的 update 目录里面，程序如下：

```JavaScript
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
```

在应用根目录下执行 `node update/class_list.js` ，稍等几秒后，命令行窗口将打印
出以下的结果：

```JSON
[ { name: '全部博文',
    url: 'http://blog.sina.com.cn/s/articlelist_1776757314_0_1.html',
    id: '0' },
  { name: '祖国大陆~',
    url: 'http://blog.sina.com.cn/s/articlelist_1776757314_1_1.html',
    id: '1' },
  { name: '纵贯台湾岛~',
    url: 'http://blog.sina.com.cn/s/articlelist_1776757314_4_1.html',
    id: '4' },
  { name: '港澳行记~',
    url: 'http://blog.sina.com.cn/s/articlelist_1776757314_5_1.html',
    id: '5' },
  { name: '缤纷东南亚~',
    url: 'http://blog.sina.com.cn/s/articlelist_1776757314_6_1.html',
    id: '6' },
  { name: '澳大利亚~',
    url: 'http://blog.sina.com.cn/s/articlelist_1776757314_7_1.html',
    id: '7' },
  { name: '日本~',
    url: 'http://blog.sina.com.cn/s/articlelist_1776757314_8_1.html',
    id: '8' },
  { name: '美国~',
    url: 'http://blog.sina.com.cn/s/articlelist_1776757314_9_1.html',
    id: '9' },
  { name: 'MY烘焙生活~',
    url: 'http://blog.sina.com.cn/s/articlelist_1776757314_2_1.html',
    id: '2' },
  { name: '小日子~',
    url: 'http://blog.sina.com.cn/s/articlelist_1776757314_3_1.html',
    id: '3' } ]
```


### 获取分类下的文章列表

下面以“全部博文”这个分类下的文章为例，读取相关的文章列表。首先我们在浏览器中打开
文章列表页面： http://blog.sina.com.cn/s/articlelist_1776757314_0_1.html

![示例新浪博客文章列表页面][5]

相关部分的 HTML 代码如下：

```HTML
<div class="articleList">
  <!-- 列表 START -->
  <div class="articleCell SG_j_linedot1">
    <p class="atc_main SG_dot">
      <span class="atc_ic_f">
        <a href="http://www.sina.com.cn/" target="_blank">
          <img class="SG_icon SG_icon107" src="http://simg.sinajs.cn/blog7style/images/common/sg_trans.gif" width="18" height="18" title="已推荐到新浪首页，点击查看更多精彩内容" align="absmiddle">
        </a>
      </span>
      <span class="atc_title">
        <a title="同里古镇：你的烟雨江南，我的慢生活" target="_blank" href="http://blog.sina.com.cn/s/blog_69e72a420101gvec.html">同里古镇：你的烟雨江南，我的慢生…</a>
      </span>
      <span class="atc_ic_b">
        <img class="SG_icon SG_icon18" src="http://simg.sinajs.cn/blog7style/images/common/sg_trans.gif" width="15" height="15" title="此博文包含图片" align="absmiddle">
      </span>
    </p>
    <p class="atc_info">
      <span class="atc_data" id="count_69e72a420101gvec">(
        <span title="评论数">68</span>/
        <span title="阅读数">2085</span>)</span>
      <span class="atc_tm SG_txtc">2013-11-12 09:24</span>
      <span class="atc_set">
      </span>
    </p>
  </div>

  (由于篇幅过长，此处省略若干个 <div class="articleCell SG_j_linedot1"></div> 代码块...)

  <!-- 列表END -->
</div>
```

与获取分类列表的例子类似，我们只需要通过 `$('.articleList .articleCell')` 来获取
到文章相对应的 div 标签，并从中提取出标题、URL、发表时间和文章的 ID 即可。

新建文件 `article_list.js` ，保存到应用根目录下的 update 目录里面，程序如下：

```JavaScript
var request = require('request');
var cheerio = require('cheerio');
var debug = require('debug')('blog:update');

debug('读取博文列表');

// 读取分类页面
request('http://blog.sina.com.cn/s/articlelist_1776757314_0_1.html', function (err, res) {
  if (err) return console.error(err);

  // 根据网页内容创建DOM操作对象
  var $ = cheerio.load(res.body.toString());

  // 读取博文列表
  var articleList = [];
  $('.articleList .articleCell').each(function () {
    var $me = $(this);
    var $title = $me.find('.atc_title a');
    var $time = $me.find('.atc_tm');
    var item = {
      title: $title.text().trim(),
      url:   $title.attr('href'),
      time:  $time.text().trim()
    };
    // 从URL中取出文章的ID
    var s = item.url.match(/blog_([a-zA-Z0-9]+)\.html/);
    if (Array.isArray(s)) {
      item.id = s[1];
      articleList.push(item);
    }
  });

  // 输出结果
  console.log(articleList);
});
```

在应用根目录下执行 `node update/article_list.js` ，稍等几秒后，命令行窗口将打印
出以下的结果：

```JSON
[ { title: '同里古镇：你的烟雨江南，我的慢生…',
    url: 'http://blog.sina.com.cn/s/blog_69e72a420101gvec.html',
    time: '2013-11-12 09:24',
    id: '69e72a420101gvec' },
  { title: '苏州吴江：吴越美食之旅',
    url: 'http://blog.sina.com.cn/s/blog_69e72a420101guyi.html',
    time: '2013-11-08 09:16',
    id: '69e72a420101guyi' },

  (由于篇幅过长，此处省略若干行...)

  { title: '昂坪360：全景大屿山',
    url: 'http://blog.sina.com.cn/s/blog_69e72a4201015fqf.html',
    time: '2012-06-14 12:30',
    id: '69e72a4201015fqf' } ]
```

上面的代码只能获取到一页的文章列表。如果该分类下有多页的话，我们需要在程序中检查
是否有 **下一页** 的链接，如果有的话，自动读取下一页的文章列表，最后将结果一并返
回：

![示例新浪博客文章列表页面页码部分][7]

修改后的程序如下：

```JavaScript
var request = require('request');
var cheerio = require('cheerio');
var debug = require('debug')('blog:update');

debug('读取博文列表');


function readArticleList (url, callback) {
  // 读取分类页面
  request(url, function (err, res) {
    if (err) return callback(err);

    // 根据网页内容创建DOM操作对象
    var $ = cheerio.load(res.body.toString());

    // 读取博文列表
    var articleList = [];
    $('.articleList .articleCell').each(function () {
      var $me = $(this);
      var $title = $me.find('.atc_title a');
      var $time = $me.find('.atc_tm');
      var item = {
        title: $title.text().trim(),
        url:   $title.attr('href'),
        time:  $time.text().trim()
      };
      // 从URL中取出文章的ID
      var s = item.url.match(/blog_([a-zA-Z0-9]+)\.html/);
      if (Array.isArray(s)) {
        item.id = s[1];
        articleList.push(item);
      }
    });

    // 检查是否有下一页
    var nextUrl = $('.SG_pgnext a').attr('href');
    if (nextUrl) {
      // 读取下一页
      readArticleList(nextUrl, function (err, articleList2) {
        if (err) return callback(err);

        // 合并结果
        callback(null, articleList.concat(articleList2));
      });
    } else {
      // 返回结果
      callback(null, articleList);
    }
  });
}

readArticleList('http://blog.sina.com.cn/s/articlelist_1776757314_0_1.html', function (err, articleList) {
  if (err) console.error(err.stack);
  console.log(articleList);
});
```


### 获取文章的内容

打开其中一个文章的页面，比如
http://blog.sina.com.cn/s/blog_69e72a420101gvec.html
，其截图如下：

![示例新浪博客文章页面][6]

在这个页面中，我们需要取得文章的标签列表和文章的内容。

标签相关部分的 HTML 代码如下：

```HTML
<td class="blog_tag">
  <script>
  var $tag = '苏州吴江,同里古镇,游记,攻略,穿心弄';
  var $tag_code = '741057cb358132add2a3e82ea8dd61b5';
  var $r_quote_bligid = '69e72a420101gvec';
  var $worldcup = '0';
  var $worldcupball = '0';
  </script>
  <span class="SG_txtb">标签：</span>
  <h3><a href="http://search.sina.com.cn/?c=blog&amp;q=%CB%D5%D6%DD%CE%E2%BD%AD&amp;by=tag" target="_blank">苏州吴江</a>
  </h3>
  <h3><a href="http://search.sina.com.cn/?c=blog&amp;q=%CD%AC%C0%EF%B9%C5%D5%F2&amp;by=tag" target="_blank">同里古镇</a>
  </h3>
  <h3><a href="http://search.sina.com.cn/?c=blog&amp;q=%D3%CE%BC%C7&amp;by=tag" target="_blank">游记</a>
  </h3>
  <h3><a href="http://search.sina.com.cn/?c=blog&amp;q=%B9%A5%C2%D4&amp;by=tag" target="_blank">攻略</a>
  </h3>
  <h3><a href="http://search.sina.com.cn/?c=blog&amp;q=%B4%A9%D0%C4%C5%AA&amp;by=tag" target="_blank">穿心弄</a>
  </h3>
</td>
```

我们只需要通过 `$('.blog_tag h3 a')` 来取得文章标签所在的 a 标签，并取其文本内容即可。

文章内容相关的 HTML 代码如下：

```HTML
<div id="sina_keyword_ad_area2" class="articalContent">
  <p>
    <a href="http://photo.blog.sina.com.cn/showpic.html#blogid=69e72a420101gvec&amp;url=http://album.sina.com.cn/pic/001Wf5K2gy6E8xjFxxl5f" target="_blank">
      <img name="image_operate_53741384158351109" src="http://s16.sinaimg.cn/mw690/001Wf5K2gy6E8xjFxxl5f&amp;690" real_src="http://s16.sinaimg.cn/mw690/001Wf5K2gy6E8xjFxxl5f&amp;690" width="454" height="680" alt="同里古镇：你的烟雨江南，我的慢生活" title="同里古镇：你的烟雨江南，我的慢生活" action-data="http%3A%2F%2Fs16.sinaimg.cn%2Fmw690%2F001Wf5K2gy6E8xjFxxl5f%26690" action-type="show-slide">
    </a>
    <br>
    <font style="FonT-siZe: 16px">总有一段时光，浪费在江南。</font>
  </p>

  (由于篇幅过长，此处省略若干行...)

</div>
```

文章内容也只需要通过 `$('.articalContent').html()` 即可取得。

新建文件 `article_detail.js` ，保存到应用根目录下的 update 目录里面，程序如下：

```JavaScript
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
```

在应用根目录下执行 `node update/article_detail.js` ，稍等几秒后，命令行窗口将打
印出以下的结果：

```JSON
{ tags: [ '苏州吴江', '同里古镇', '游记', '攻略', '穿心弄' ],
  content: '<p>(由于HTML过长。此处省略...)</p>' }
```


### 获取文章分类下的所有文章

前面的例子中我们已经知道了如何读取一个分类下的所有文章列表，以及获取指定文章的
详细内容。要想获取到文章分类下的所有文章的内容，我们需要借助 **async** 模块来
简化异步流程控制。

注：以下源码中采用了 **jsdoc** 的代码注释风格，关于该注释风格的详细说明请访问
以下网址来获取：https://code.google.com/p/jsdoc-toolkit/wiki/TagReference

新建文件 `article_all.js` ，保存到应用根目录下的 update 目录里面，程序如下：

```JavaScript
var request = require('request');
var cheerio = require('cheerio');
var async = require('async');
var debug = require('debug')('blog:update');


/**
 * 获取分类页面博文列表
 *
 * @param {String} url
 * @param {Function} callback
 */
function readArticleList (url, callback) {
  debug('读取博文列表：%s', url);

  request(url, function (err, res) {
    if (err) return callback(err);

    // 根据网页内容创建DOM操作对象
    var $ = cheerio.load(res.body.toString());

    // 读取博文列表
    var articleList = [];
    $('.articleList .articleCell').each(function () {
      var $me = $(this);
      var $title = $me.find('.atc_title a');
      var $time = $me.find('.atc_tm');
      var item = {
        title: $title.text().trim(),
        url:   $title.attr('href'),
        time:  $time.text().trim()
      };
      // 从URL中取出文章的ID
      var s = item.url.match(/blog_([a-zA-Z0-9]+)\.html/);
      if (Array.isArray(s)) {
        item.id = s[1];
        articleList.push(item);
      }
    });

    // 返回结果
    callback(null, articleList);
  });
}

/**
 * 获取博文页面内容
 *
 * @param {String} url
 * @param {Function} callback
 */
function readArticleDetail (url, callback) {
  debug('读取博文内容：%s', url);

  request(url, function (err, res) {
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

    // 返回结果
    callback(null, {tags: tags, content: content});
  });
}


// 读取分类下的所有文章
readArticleList('http://blog.sina.com.cn/s/articlelist_1776757314_0_1.html', function (err, articleList) {
  if (err) return console.error(err.stack);

  // 依次取出 articleList 数组的每个元素，调用第二个参数中传入的函数
  // 函数的第一个参数即是 articleList 数组的其中一个元素
  // 函数的第二个参数是回调函数
  async.eachSeries(articleList, function (article, next) {

    // 读取文章内容
    readArticleDetail(article.url, function (err, detail) {
      if (err) console.error(err.stack);

      // 直接显示
      console.log(detail);

      // 需要调用 next() 来返回
      next();
    });

  }, function (err) {
    // 当遍历完 articleList 后，执行此回调函数

    if (err) return console.error(err.stack);

    console.log('完成');
  });

});
```

在应用根目录下执行 `node update/article_all.js` ，命令行窗口将依次打印出该文章分
类下的所有文章内容，直到打印出“ **完成** ”程序自动退出。


### 将结果保存到数据库中

上面的例子中，我们已经掌握了从网页内容中提取出文章列表等信息，下面需要把这些信息
保存到数据库中。

首先在数据库（假设本实例的数据库为 sina_blog）中分别建立四个表，其结构如下：

表 **class_list**

字段 | 类型 | 说明
- |
id | int(11) | 文章分类的ID，主键
url | varchar(255) | 文章分类页面的URL
name | varchar(50) | 文章分类名称
count | int(11) | 文章数量

表 **article_list**

字段 | 类型 | 说明
- |
id | varchar(20) | 文章的ID，与 class_id 为联合主键
title | varchar(255) | 文章标题
url | varchar(255) | 文章页面的URL
class_id | int(11) | 文章所属的分类ID，与 id 为联合主键
created_time | int(11) | 文章发布时间

表 **article_tag**

字段 | 类型 | 说明
- |
id | varchar(20) | 文章的ID，与 tag 为联合主键
tag | varchar(20) | 标签名称，与 id 为联合主键

表 **article_detail**

字段 | 类型 | 说明
- |
id | varchar(20) | 文章的ID
tags | varchar(255) | 文章标签
content | text | 文章内容

我们先测试一下能否正常连接到数据库。
新建文件 `test_db.js` ，保存到应用根目录下的 update 目录里面，程序如下：
（需要将程序中相应部分改成实际的内容）

```JavaScript
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
```

在应用根目录下执行 `node update/test_db.js` ，稍等几秒后，命令行窗口将打印
出以下的结果：

```JSON
[ { Tables_in_sina_blog: 'article_detail' },
  { Tables_in_sina_blog: 'article_list' },
  { Tables_in_sina_blog: 'article_tag' },
  { Tables_in_sina_blog: 'class_list' } ]
```

这说明数据库相关的初始化工作已经做好了。

#### 保存文章分类

在保存文章分类的时候，如果分类已存在，则更新一下，否则直接插入到数据库中。
保存文章分类的操作可以写到一个函数里面：

```JavaScript
/**
 * 保存文章分类
 *
 * @param {Object} data
 * @param {Function} callback
 */
function saveClassItem (data, callback) {
  // 查询分类是否已存在
  db.query('SELECT * FROM `class_list` WHERE `id`=? LIMIT 1', [data.id], function (err) {
    if (err) return next(err);

    if (Array.isArray(data) && data.length >= 1) {
      // 分类已存在，更新一下
      db.query('UPDATE `class_list` SET `name`=?, `url`=? WHERE `id`=?', [data.name, data.url, data.id], callback);
    } else {
      // 分类不存在，添加
      db.query('INSERT INTO `class_list`(`id`, `name`, `url`) VALUES (?, ?, ?)', [data.id, data.name, data.url], callback);
    }
  });
}
```

保存文章内容，文章标签跟上面的例子类似。现在我们把以上的例子都结合起来，实现抓取
到文章分类之后，立刻将其保存到数据库中，再抓取所有的文章内容，并保存到数据库中。


### 一个完整的爬虫实例

新建 **配置文件** `config.js` ，保存到应用根目录下，程序如下：

```JavaScript
// MySQL数据库连接配置
var mysql = require('mysql');
exports.db = mysql.createConnection({
  host:            '127.0.0.1',   // 数据库地址
  port:            3306,          // 数据库端口
  database:        'sina_blog',   // 数据库名称
  user:            'root',        // 数据库用户
  password:        ''             // 数据库用户对应的密码
});

// 博客配置
exports.sinaBlog = {
  url: 'http://blog.sina.com.cn/u/1776757314'  // 博客首页地址
};

```

新建文件 `read.js` ，保存到应用根目录下的 update 目录里面，程序如下：

```JavaScript
var originRequest = require('request');
var cheerio = require('cheerio');
var debug = require('debug')('blog:update:read');


/**
 * 请求指定URL
 *
 * @param {String} url
 * @param {Function} callback
 */
function request (url, callback) {
  originRequest(url, callback);
}


/**
 * 获取文章分类列表
 *
 * @param {String} url
 * @param {Function} callback
 */
exports.classList = function (url, callback) {
  debug('读取文章分类列表：%s', url);

  request(url, function (err, res) {
    if (err) return callback(err);

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

    // 返回结果
    callback(null, classList);
  });
};

/**
 * 获取分类页面博文列表
 *
 * @param {String} url
 * @param {Function} callback
 */
exports.articleList = function (url, callback) {
  debug('读取博文列表：%s', url);

  request(url, function (err, res) {
    if (err) return callback(err);

    // 根据网页内容创建DOM操作对象
    var $ = cheerio.load(res.body.toString());

    // 读取博文列表
    var articleList = [];
    $('.articleList .articleCell').each(function () {
      var $me = $(this);
      var $title = $me.find('.atc_title a');
      var $time = $me.find('.atc_tm');
      var item = {
        title: $title.text().trim(),
        url:   $title.attr('href'),
        time:  $time.text().trim()
      };
      // 从URL中取出文章的ID
      var s = item.url.match(/blog_([a-zA-Z0-9]+)\.html/);
      if (Array.isArray(s)) {
        item.id = s[1];
        articleList.push(item);
      }
    });

    // 检查是否有下一页
    var nextUrl = $('.SG_pgnext a').attr('href');
    if (nextUrl) {
      // 读取下一页
      exports.articleList(nextUrl, function (err, articleList2) {
        if (err) return callback(err);

        // 合并结果
        callback(null, articleList.concat(articleList2));
      });
    } else {
      // 返回结果
      callback(null, articleList);
    }
  });
};

/**
 * 获取博文页面内容
 *
 * @param {String} url
 * @param {Function} callback
 */
exports.articleDetail = function (url, callback) {
  debug('读取博文内容：%s', url);

  request(url, function (err, res) {
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

    // 返回结果
    callback(null, {tags: tags, content: content});
  });
};
```

新建文件 `save.js` ，保存到应用根目录下的 update 目录里面，程序如下：

```JavaScript
var async = require('async');
var db = require('../config').db;
var debug = require('debug')('blog:update:save');


/**
 * 保存文章分类
 *
 * @param {Object} list
 * @param {Function} callback
 */
exports.classList = function (list, callback) {
  debug('保存文章分类列表到数据库中: %d', list.length);

  async.eachSeries(list, function (item, next) {

    // 查询分类是否已存在
    db.query('SELECT * FROM `class_list` WHERE `id`=? LIMIT 1', [item.id], function (err, data) {
      if (err) return next(err);

      if (Array.isArray(data) && data.length >= 1) {
        // 分类已存在，更新一下
        db.query('UPDATE `class_list` SET `name`=?, `url`=? WHERE `id`=?', [item.name, item.url, item.id], next);
      } else {
        // 分类不存在，添加
        db.query('INSERT INTO `class_list`(`id`, `name`, `url`) VALUES (?, ?, ?)', [item.id, item.name, item.url], next);
      }
    });

  }, callback);
};

/**
 * 保存文章列表
 *
 * @param {Number} class_id
 * @param {Array} list
 * @param {Function} callback
 */
exports.articleList = function (class_id, list, callback) {
  debug('保存文章列表到数据库中: %d, %d', class_id, list.length);

  async.eachSeries(list, function (item, next) {

    // 查询文章是否已存在
    db.query('SELECT * FROM `article_list` WHERE `id`=? AND `class_id`=? LIMIT 1',
      [item.id, class_id], function (err, data) {
      if (err) return next(err);

      // 将发布时间转成时间戳（秒）
      var created_time = new Date(item.time).getTime() / 1000;

      if (Array.isArray(data) && data.length >= 1) {
        // 分类已存在，更新一下
        db.query('UPDATE `article_list` SET `title`=?, `url`=?, `class_id`=?, `created_time`=? WHERE `id`=? AND `class_id`=?',
          [item.title, item.url, class_id, created_time, item.id, class_id], next);
      } else {
        // 分类不存在，添加
        db.query('INSERT INTO `article_list`(`id`, `title`, `url`, `class_id`, `created_time`) VALUES (?, ?, ?, ?, ?)',
          [item.id, item.title, item.url, class_id, created_time], next);
      }
    });

  }, callback);
};

/**
 * 保存文章分类的文章数量
 *
 * @param {Number} class_id
 * @param {Number} count
 * @param {Function} callback
 */
exports.articleCount = function (class_id, count, callback) {
  debug('保存文章分类的文章数量：%d, %d', class_id, count);

  db.query('UPDATE `class_list` SET `count`=? WHERE `id`=?', [count, class_id], callback);
};

/**
 * 保存文章标签
 *
 * @param {String} id
 * @param {Array} tags
 * @param {Function} callback
 */
exports.articleTags = function (id, tags, callback) {
  debug('保存文章标签: %s, %s', id, tags);

  // 删除旧的标签信息
  db.query('DELETE FROM `article_tag` WHERE `id`=?', [id], function (err) {
    if (err) return callback(err);

    if (tags.length > 0) {
      // 添加新标签信息
      // 生成SQL代码
      var values = tags.map(function (tag) {
        return '(' + db.escape(id) + ', ' + db.escape(tag) + ')';
      }).join(', ');

      db.query('INSERT INTO `article_tag`(`id`, `tag`) VALUES ' + values, callback);
    } else {
      // 如果没有标签，直接返回
      callback(null);
    }
  });
};

/**
 * 保存文章内容
 *
 * @param {String} id
 * @param {Array} tags
 * @param {String} content
 * @param {Function} callback
 */
exports.articleDetail = function (id, tags, content, callback) {
  debug('保存文章内容: %s', id);

  // 检查文章是否存在
  db.query('SELECT `id` FROM `article_detail` WHERE `id`=?', [id], function (err, data) {
    if (err) return callback(err);

    tags = tags.join(' ');
    if (Array.isArray(data) && data.length >= 1) {
      // 更新文章
      db.query('UPDATE `article_detail` SET `tags`=?, `content`=? WHERE `id`=?', [tags, content, id], callback);
    } else {
      // 添加文章
      db.query('INSERT INTO `article_detail`(`id`, `tags`, `content`) VALUES (?, ?, ?)', [id, tags, content], callback);
    }
  });
};

/**
 * 检查文章是否存在
 *
 * @param {String} id
 * @param {Function} callback
 */
exports.isAericleExists = function (id, callback) {
  db.query('SELECT `id` FROM `article_detail` WHERE `id`=?', [id], function (err, data) {
    if (err) return callback(err);

    callback(null, Array.isArray(data) && data.length >= 1);
  });
};
```

新建文件 `all.js` ，保存到应用根目录下的 update 目录里面，程序如下：

```JavaScript
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
```

设置环境变量 `debug=blog:*`，并在应用根目录下执行 `node update/all.js` ，命令行
窗口将依次打印出以下信息，直到全部更新完成，程序自动退出：

```
  blog:update:read 读取文章分类列表：http://blog.sina.com.cn/u/1776757314 +0ms
  blog:update:save 保存文章分类列表到数据库中: 10 +0ms
  blog:update:read 读取博文列表：http://blog.sina.com.cn/s/articlelist_1776757314_0_1.html +5s
  blog:update:read 读取博文列表：http://blog.sina.com.cn/s/articlelist_1776757314_0_2.html +1s
  blog:update:read 读取博文列表：http://blog.sina.com.cn/s/articlelist_1776757314_0_3.html +1s
  blog:update:read 读取博文列表：http://blog.sina.com.cn/s/articlelist_1776757314_1_1.html +560ms
  blog:update:read 读取博文列表：http://blog.sina.com.cn/s/articlelist_1776757314_4_1.html +991ms
  blog:update:read 读取博文列表：http://blog.sina.com.cn/s/articlelist_1776757314_5_1.html +681ms
  blog:update:read 读取博文列表：http://blog.sina.com.cn/s/articlelist_1776757314_6_1.html +531ms
  blog:update:read 读取博文列表：http://blog.sina.com.cn/s/articlelist_1776757314_7_1.html +844ms
  blog:update:read 读取博文列表：http://blog.sina.com.cn/s/articlelist_1776757314_8_1.html +486ms
  blog:update:read 读取博文列表：http://blog.sina.com.cn/s/articlelist_1776757314_9_1.html +427ms
  blog:update:read 读取博文列表：http://blog.sina.com.cn/s/articlelist_1776757314_2_1.html +408ms
  blog:update:read 读取博文列表：http://blog.sina.com.cn/s/articlelist_1776757314_3_1.html +535ms
  blog:update:save 保存文章列表到数据库中: 0, 134 +9s
  blog:update:save 保存文章列表到数据库中: 1, 31 +709ms
  blog:update:save 保存文章列表到数据库中: 2, 11 +141ms
  blog:update:save 保存文章列表到数据库中: 3, 22 +86ms
  blog:update:save 保存文章列表到数据库中: 4, 37 +128ms
  blog:update:save 保存文章列表到数据库中: 5, 13 +148ms
  blog:update:save 保存文章列表到数据库中: 6, 19 +54ms
  blog:update:save 保存文章列表到数据库中: 7, 1 +111ms
  blog:update:save 保存文章列表到数据库中: 8, 0 +16ms
  blog:update:save 保存文章列表到数据库中: 9, 0 +9ms
  blog:update:save 保存文章分类的文章数量：0, 134 +4ms
  blog:update:save 保存文章分类的文章数量：1, 31 +5ms
  blog:update:save 保存文章分类的文章数量：2, 11 +6ms
  blog:update:save 保存文章分类的文章数量：3, 22 +5ms
  blog:update:save 保存文章分类的文章数量：4, 37 +6ms
  blog:update:save 保存文章分类的文章数量：5, 13 +5ms
  blog:update:save 保存文章分类的文章数量：6, 19 +6ms
  blog:update:save 保存文章分类的文章数量：7, 1 +6ms
  blog:update:save 保存文章分类的文章数量：8, 0 +4ms
  blog:update:save 保存文章分类的文章数量：9, 0 +15ms
  blog:update:all 整理文章列表，把重复的文章去掉 +0ms
  blog:update:read 读取博文内容：http://blog.sina.com.cn/s/blog_69e72a420101gxjh.html +2s
  blog:update:save 保存文章内容: 69e72a420101gxjh +678ms
  blog:update:save 保存文章标签: 69e72a420101gxjh, 澳洲自由行,亲子,大堡礁,墨尔本,游记攻略 +28ms
  blog:update:read 读取博文内容：http://blog.sina.com.cn/s/blog_69e72a420101flbm.html +680ms
  blog:update:save 保存文章内容: 69e72a420101flbm +767ms
  blog:update:save 保存文章标签: 69e72a420101flbm, 柳絮同学,洗脸实验,洗面奶,推荐,休闲 +33ms
  blog:update:read 读取博文内容：http://blog.sina.com.cn/s/blog_69e72a420101gvec.html +814ms
  blog:update:save 保存文章内容: 69e72a420101gvec +736ms
  blog:update:save 保存文章标签: 69e72a420101gvec, 苏州吴江,同里古镇,游记,攻略,穿心弄 +32ms
  blog:update:read 读取博文内容：http://blog.sina.com.cn/s/blog_69e72a420101guyi.html +751ms
  blog:update:save 保存文章内容: 69e72a420101guyi +1s

  (由于篇幅过长，此处省略若干行...)
```


## 显示数据库中的数据

上面爬虫的例子中，我们已经取得了整个博客的基本数据，现在只要从数据库中查询出这些
数据，通过自己搭建的 web 服务器就可以随心所欲地显示出来了。由于上一节中已经介绍
了如何从 MySQL 数据库中查询数据，本节将重点讲解如何通过 express 模块来创建一个
web 服务器，以及通过 ejs 模板来渲染这些数据。

### 相关模块介绍

#### 使用 express 模块来创建一个 web 服务器

**express** 是一个简洁而灵活的 Node.js Web 应用框架，提供一系列强大特性帮助你
创建各种基于 Web 应用。

以下是一个 express 模块的使用示例：

```JavaScript
var express = require('express');
var app = express();

app.get('/', function(req, res){
  res.send('hello world');
});

app.listen(3000);
```

运行以上程序后，在浏览器中打开 http://127.0.0.1:3000 即可看到页面中输出了
“ **hello world** ”。

关于 **express** 模块的详细使用方法，可访问 http://expressjs.com/ ，
或者其中文版镜像： http://express.jsbin.cn/


#### 使用 ejs 模块来显示页面内容

**ejs** 是 Node.js 下使用最广泛的模板引擎之一，其语法简单灵活，通过 express 命令
行工具创建的项目，一般都会选用 ejs 作为默认的模板引擎。

以下是 ejs 模板引擎语法的示例：

```JavaScript
<% if (user) { %>
  <h2><%= user.name %></h2>
<% } %>
```

感兴趣的读者可以访问 ejs 模块的主页来获取详细使用说明：
https://npmjs.org/package/ejs


### 创建 Web 服务器前的工作

由于本实例将使用 express 和 ejs 这两个模块，所以我们需要将其添加到应用根目录的
package.json 文件中：

```JSON
{
  "name":           "sina-blog-proxy",
  "main":           "app.js",
  "version":        "0.0.1",
  "private":        true,
  "description":    "网络爬虫与数据库操作",
  "engines": {
    "node":         ">= 0.10.0"
  },
  "dependencies": {
    "debug":        "0.7.2",
    "cheerio":      "0.12.3",
    "request":      "2.27.0",
    "async":        "0.2.9",
    "mysql":        "2.x",
    "express":      "3.4.0",
    "ejs":          "0.8.4"
  }
}
```

+ 在应用根目录下新建目录 web ，本实例中的 Web 处理程序将保存在此目录下；
+ 在应用根目录下执行命令 `npm install` 来安装所有的依赖模块。


### 查询数据

新建文件 `read.js` ，保存到应用根目录下的 web 目录里面，程序如下：

```JavaScript
var async = require('async');
var db = require('../config').db;
var debug = require('debug')('blog:web:read');


/**
 * 获取文章分类列表
 *
 * @param {Function} callback
 */
exports.classList = function (callback) {
  debug('获取文章分类列表');

  db.query('SELECT * FROM `class_list` ORDER BY `id` ASC', callback);
};

/**
 * 检查分类是否存在
 *
 * @param {Number} id
 * @param {Function} callback
 */
exports.isClassExists = function (id, callback) {
  debug('检查分类是否存在：%s', id);

  db.query('SELECT * FROM `class_list` WHERE `id`=? LIMIT 1', [id], function (err, ret) {
    if (err) return next(err);

    callback(null, Array.isArray(ret) && ret.length > 0);
  });
};

/**
 * 获取指定分类的信息
 *
 * @param {Number} id
 * @param {Function} callback
 */
exports.class = function (id, callback) {
  debug('获取指定分类的信息：%s', id);

  db.query('SELECT * FROM `class_list` WHERE `id`=? LIMIT 1', function (err, list) {
    if (err) return callback(err);
    if (!(list.length > 0)) return callback(new Error('该分类不存在'));

    callback(null, list[0]);
  });
};

/**
 * 获取指定文章的详细信息
 *
 * @param {String} id
 * @param {Function} callback
 */
exports.article = function (id, callback) {
  debug('获取指定文章的详细信息：%s', id);

  var sql = 'SELECT * FROM `article_list` AS `A`' +
            ' LEFT JOIN `article_detail` AS `B` ON `A`.`id`=`B`.`id`' +
            ' WHERE `A`.`id`=? LIMIT 1';
  db.query(sql, [id], function (err, list) {
    if (err) return callback(err);
    if (!(list.length > 0)) return callback(new Error('该文章不存在'));

    callback(null, list[0]);
  });
};

/**
 * 获取指定分类下的文章列表
 *
 * @param {Number} classId
 * @param {Number} offset
 * @param {Number} limit
 * @param {Function} callback
 */
exports.articleListByClassId = function (classId, offset, limit, callback) {
  debug('获取指定分类下的文章列表：%s, %s, %s', classId, offset, limit);

  var sql = 'SELECT * FROM `article_list` AS `A`' +
            ' LEFT JOIN `article_detail` AS `B` ON `A`.`id`=`B`.`id`' +
            ' WHERE `A`.`class_id`=?' +
            ' ORDER BY `created_time` DESC LIMIT ?,?';
  db.query(sql, [classId, offset, limit], callback);
};

/**
 * 获取指定标签下的文章列表
 *
 * @param {String} tag
 * @param {Number} offset
 * @param {Number} limit
 * @param {Function} callback
 */
exports.articleListByTag = function (tag, offset, limit, callback) {
  debug('获取指定标签下的文章列表：%s, %s, %s', tag, offset, limit);

  var sql = 'SELECT * FROM `article_list` WHERE `id` IN (' +
            ' SELECT `id` FROM `article_tag` WHERE `tag`=?)' +
            ' ORDER BY `created_time` DESC LIMIT ?,?';
  db.query(sql, [tag, offset, limit], callback);
};

/**
 * 获取指定标签下的文章数量
 *
 * @param {String} tag
 * @param {Function} callback
 */
exports.articleCountByTag = function (tag, callback) {
  debug('获取指定标签下的文章数量：%s', tag);

  db.query('SELECT COUNT(*) AS `c` FROM `article_tag` WHERE `tag`=?', [tag], function (err, ret) {
    if (err) return callback(err);

    callback(null, ret[0].c);
  });
};
```


### 博客首页

博客首页应该显示“ **全部博文** ”的文章列表，其 ID 是 0，因此我们可以通过
`read.articleListByClassId()` 来查询出相关的文章列表。

在应用根目录下的配置文件 `config.js` 末尾添加以下配置信息：

```JavaScript
// Web服务器端口
exports.port = 3000;
```

新建文件 `app.js` ，保存到应用根目录下，程序如下：

```JavaScript
var path = require('path');
var express = require('express');
var read = require('./web/read');
var config = require('./config');

var app = express();

// 配置 express
app.configure(function () {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(app.router);
  app.use('/public', express.static(path.join(__dirname, 'public')));
});

// 网站首页
app.get('/', function(req, res, next){
  // articleListByClassId 的第一个参数是文章分类的 ID
  // 第二个参数是返回结果的开始位置
  // 第三个参数是返回结果的数量
  read.articleListByClassId(0, 0, 20, function (err, list) {
    if (err) return next(err);

    // 渲染模板
    res.locals.articleList = list;
    res.render('index');
  });
});

app.listen(config.port);
console.log('服务器已启动');
```

在应用根目录下创建目录 `views` ，新建文件 `index.ejs` ，保存到该目录下，
程序如下：

```HTML
<h1>我的博客首页</h1>
<ul>
<% articleList.forEach(function (article) { %>
  <li><a href="/article/<%= article.id %>"><%= article.title %></a></li>
<% }) %>
</ul>
```

在应用根目录下执行 `node app.js` ，待控制台窗口打印出“ **服务器已启动** ” 文本
之后，在浏览器中打开 http://127.0.0.1:3000 ，即可看到如下图的页面：

![实例博客首页][8]


### 文章页面

文章内容我们可以通过 `read.article()` 来取得。打开应用根目录的文件 `app.js` ，
在 `app.listen(config.port)` 这一行前面添加以下程序：

```JavaScript
// 文章页面
app.get('/article/:id', function (req, res, next) {
  // 通过 req.params.id 来取得 URL 中 :id 部分的参数
  read.article(req.params.id, function (err, article) {
    if (err) return next(err);

    // 渲染模板
    res.locals.article = article;
    res.render('article');
  });
});
```

新建文件 `article.ejs` ，保存到应用根目录下的 views 目录里面，程序如下：

```HTML
<div style="max-width:600px; margin:auto;">
  <h1><%= article.title %></h1>

  <%- article.content %>
</div>
```

重新执行 `app.js` ，在博客首页中点击某一个文章标题，将会打开该文章页面，如下图：

![实例博客文章页面][9]


#### 关于 ejs 模板语法的说明

细心的读者会发现，输出标题的时候我们用的是 `<%= article.title %>` ，而输出内容的
时候用的是 `<%- article.content %>` 。一般情况下，为了安全起见，一般输出都是使用
`<%= data %>` ，这样输出的数据都是经过字符串转义的，由于文章的内容都是些 HTML 代
码，为了保留其原来的格式，我们需要使用 `<%- data %>` 来告诉模板引擎不要对这些数
据进行转义。


## 自动更新文章数据

在“网络爬虫”一节中我们已经可以通过 `update/all.js` 这个程序来把网站上的数据同步
到自己的数据库了。当网站有更新的时候，我们再手动执行更新，就显得有些笨拙。为了能
让网站内容更新的时候及时自动同步，我们需要配置一个计划任务，然后让程序自动在指定
的时间执行。


### 相关模块介绍

#### 使用 cron 模块来定时执行任务

Linux 系统有一个定时执行任务的工具 cron，其可以通过简单的语法来配置执行任务的规
则，比如 `00 30 11 * * 1-5` 表示“周一至周五每天上午11:30执行一次”。
Node.js 也有一个叫 *cron* 的模块实现了类似的功能，以下是 cron 模块的使用示例：

```
var cronJob = require('cron').CronJob;

var job1 = new cronJob('* * * * * *', function(){
    console.log('每秒执行一次');
});
job1.start();

var job2 = new cronJob('*/5 * * * * *', function(){
    console.log('  每5秒执行一次');
});
job2.start();
```

运行上面这段程序，将会看到类似下面这样的输出：

```
每秒执行一次
每秒执行一次
  每5秒执行一次
每秒执行一次
每秒执行一次
每秒执行一次
每秒执行一次
  每5秒执行一次
每秒执行一次
每秒执行一次
每秒执行一次
每秒执行一次
每秒执行一次
  每5秒执行一次
每秒执行一次
每秒执行一次
每秒执行一次
```

cron 语法格式如下：

`f1 f2 f3 f4 f5 f5 f6`

其中 f1 表示秒钟，f2 表示分钟，f3 表示小时，f4 表示一个月份中的第几日，f5 表示月
份，f6 表示一个星期中的第几天。各部分的取值含义如下（以 f1 部分为例，其他部分类
似）：

+ 当值为 `*` 时，表示每秒执行一次；
+ 当值为 `a-b` 时，表示从第 a 秒钟到第 b 秒钟这段时间内执行一次；
+ 当值为 `*/n` 时，表示每隔 n 秒钟执行一次；
+ 当值为 `a-b/n` 时，表示从第 a 秒钟到第 b 秒钟这段时间内每隔 n 秒钟执行一次。

**cron** 模块的详细使用说明可以访问以下网址获取： https://npmjs.org/package/cron

cron 的详细语法可以参考 Linux 的 **crontab** 命令使用说明：
http://baike.baidu.com/view/1229061.htm


#### 使用内置的 child_process 模块来执行文件

**child_process** 模块主要用于启动一个新的进程。在本实例中，将通过 child_process
模块来替代之前手动执行 `node update/all.js` 实现自动更新。

**child_process** 模块主要可以通过 **spawn()** 和 **exec()** 两种方法来启动一个
新进程，以下是两种方法的简单示例：

使用 `child_process.spawn()` 启动子进程：

```JavaScript
var child_process = require('child_process');

// spawn() 是直接运行文件的，而在 Windows 系统下 dir 命令是cmd.exe的内置命令
// 并不实际存在名为 dir.exe 的可执行文件，所以这里需要判断一下
if (process.platform === 'win32') {
  var dir = child_process.spawn('cmd.exe', ['/s', '/c', 'dir', 'c:\\']);
} else {
  var dir = child_process.spawn('dir', ['/']);
}

// 当子进程有输出时，自动将其输出到当前进程的标准输出流
dir.stdout.pipe(process.stdout);
dir.stderr.pipe(process.stderr);

// 进程结束时触发 close 事件
dir.on('close', function (code) {
  console.log('进程结束，代码=%d', code);
});
```

使用 `child_process.exec()` 启动子进程：

```JavaScript
var child_process = require('child_process');

// 选项
var options = {
  // 输出缓冲区的大小，默认是200K，如果进程的输出超过这个值，会抛出异常
  // 并结束该进程
  maxBuffer: 200*1024
};

var dir = child_process.exec('dir *', options, function (err, stdout, stderr) {
  if (err) throw err;

  console.log('stdout: ' + stdout);
  console.error('stderr: ' + stderr);
});
```

child_process 模块的 `spawn()` 方法和 `exec()` 方法的区别主要有以下几点：

+ `spawn()` 执行的命令必须是一个实际存在的可执行文件，而 `exec()` 执行的命令则与
  在命令行下执行的命令一样；
+ `exec()` 可以在回调函数中一次性返回子进程在 **stdout** 和 **stderr** 中输出的
  内容，但调用两者都会返回一个 **ChildProcess** 实例，通过监听其 stdout 和
  stderr 属性的 `data` 事件均可获取到进程的输出；
+ 使用 `exec()` 启动子进程时，可以指定 **maxBuffer** 参数，默认为 200K，如果子进
  程的输出大于这个值，将会抛出 **Error: stdout maxBuffer exceeded** 异常，并结束
  该子进程。

前面已经介绍了如何使用 `child_process` 模块来其启动一个新的进程，在本实例中，要
执行的是一个 Node.js 程序，我们可以通过 `process.execPath` 来取得当前 Node.js
进程的可执行文件路径，再使用 `child_process.spawn()` 来执行该可执行文件，将要执
行的 Node.js 程序作为第一个参数，比如：

```JavaScript
var child_process = require('child_process');

function execNodeFile (file) {
  var node = child_process.spawn(process.execPath, [file]);

  // 当子进程有输出时，自动将其输出到当前进程的标准输出流
  node.stdout.pipe(process.stdout);
  node.stderr.pipe(process.stderr);

  // 进程结束时触发 close 事件
  node.on('close', function (code) {
    console.log('进程结束，代码=%d', code);
  });
}

// 执行 Node.js 程序文件 abc.js
execNodeFile('abc.js');
```

关于 **child_process** 模块的详细使用方法可以访问 Node.js API 文档页面来获取：
http://nodejs.org/api/child_process.html


### 准备工作

由于本实例将使用 cron 这个模块，所以我们需要将其添加到应用根目录的 package.json
文件中：

```JSON
{
  "name":           "sina-blog-proxy",
  "main":           "app.js",
  "version":        "0.0.1",
  "private":        true,
  "description":    "网络爬虫与数据库操作",
  "engines": {
    "node":         ">= 0.10.0"
  },
  "dependencies": {
    "debug":        "0.7.2",
    "cheerio":      "0.12.3",
    "request":      "2.27.0",
    "async":        "0.2.9",
    "mysql":        "2.x",
    "express":      "3.4.0",
    "ejs":          "0.8.4",
    "cron":         "1.0.1"
  }
}
```

在应用根目录下执行命令 `npm install` 来安装所有的依赖模块。


### 定时执行更新任务

在应用根目录下的配置文件 `config.js` 末尾添加以下配置信息：

```JavaScript
// 定时更新
exports.autoUpdate = '* */30 * * *';  // 任务执行规则，参考 cron 语法
```

在应用根目录下的文件 `app.js` 末尾添加以下代码：

```JavaScript
// 定时执行更新任务
var spawn = require('child_process').spawn;
var cronJob = require('cron').CronJob;

var job = new cronJob(config.autoUpdate, function () {
  console.log('开始执行定时更新任务');
  var update = spawn(process.execPath, [path.resolve(__dirname, 'update/all.js')]);
  update.stdout.pipe(process.stdout);
  update.stderr.pipe(process.stderr);
  update.on('close', function (code) {
    console.log('更新任务结束，代码=%d', code);
  });
});
job.start();
```

重新启动程序 `app.js` 即可自动运行更新任务。


## 让程序更稳定地运行

### 处理 uncaughtException 事件

大多数情况下，异步 IO 操作（如读写本地文件，网络连接等）所发生的错误是无法被
`try {} catch (err) {}` 捕捉到的。如果其所抛出的异常没有被捕捉到，将会导致
Node.js 进程直接退出。而本实例恰恰需要大量地操作网络连接。

在 Node.js 中，如果一个抛出的异常没有被 `try {} catch (err) {}` 捕捉到，其会尝试
将这些错误交由 `uncaughtException` 事件处理程序来处理，仅当没有注册该事件处理程
序时，才会最终导致进程直接退出。因此，我们可以通过在本实例的 `app.js` 文件中添加
`uncaughtException` 事件的处理程序来避免进程异常退出：

在 `app.js` 文件末尾增加以下程序：

```
process.on('uncaughtException', function (err) {
  console.error('uncaughtException: %s', err.stack);
});
```

关于 `uncaughtException` 事件的详细说明，请参考 Node.js 的 API 文档：
http://nodejs.org/api/process.html#process_event_uncaughtexception


### 使用 pm2 来启动程序

有时候，由于 Node.js 自身的 Bug 或者使用到的第三方 C++ 模块的缺陷而导致一些底层
的错误，比如在 Linux 系统下偶尔会发生段错误（segment fault）导致进程崩溃，此时
上面提到的处理 uncaughtException 事件的方法就不适用了。

pm2 是一个功能强大的进程管理器，通过 `pm2 start` 来启动 Node.js 程序，当该进程异
常退出时，pm2 会自动尝试重启进程，这样可以保证 Node.js 应用稳定运行。同时 pm2 还
可以很方便地查看其所启动的各个进程的内存占用和日志等信息。


#### 安装 pm2

在命令行下执行 `npm install -g pm2` 安装 pm2 命令行工具。


#### 启动和停止程序

假如要启动的程序文件路径是 `~/app.js` ，在命令行下执行 `pm2 start ~/app.js` 即可
启动程序，执行 `pm2 stop ~/app.js` 即可停止该程序。

关于 pm2 命令行工具的详细使用方法，可访问该工具的主页来获取：
https://npmjs.org/package/pm2


## 处理 GBK 编码的网页

由于历史原因，国内有些网站还在使用 GBK 字符编码显示（比如淘宝网），而 JavaScript
内部的字符编码是使用 Unicode 来表示的，因此在编写爬虫来处理这些 GBK 编码的网页内
容时还需要将这些内容转成 UTF-8 编码。

比如运行下面的程序来抓取一个 GBK 编码的网页：

```JavaScript
var request = require('request');
var cheerio = require('cheerio');

request('http://www.taobao.com/', function (err, res, body) {
  if (err) throw err;

  var $ = cheerio.load(body);

  // 输出网页的标题
  console.log($('head title').text());
});
```

执行以上程序，输出的内容是空白的，因为 Node.js 把 GBK 编码的网页内容当作 Unicode
编码来处理了。下面将演示如何正确处理这些内容：

首先在命令行下执行 `npm install iconv-lite` 来安装 **iconv-lite** 模块，再运行
以下程序：

```JavaScript
var request = require('request');
var cheerio = require('cheerio');
var iconv = require('iconv-lite');

request({
  url: 'http://www.taobao.com/',
  // 重点，设置 request 抓取网页时不要对接收到的数据做任何转换
  encoding: null
}, function (err, res, body) {
  if (err) throw err;

  // 转换 gbk 编码的网页内容
  body = iconv.decode(body, 'gbk');

  var $ = cheerio.load(body);

  // 输出网页的标题
  console.log($('head title').text());
});
```

执行以上程序后，将会看到程序正确地打印出了网页的标题“ **淘宝网 - 淘！我喜欢** ”。

另外，我们还可以使用一个叫 **gbk** 模块来实现相同的效果：

首先在命令行下执行 `npm install gbk` 来安装该模块，再运行以下程序：

```JavaScript
var cheerio = require('cheerio');
var gbk = require('gbk');

gbk.fetch('http://www.taobao.com/','utf-8').to('string', function (err, body) {
  if (err) throw err;

  var $ = cheerio.load(body);

  // 输出网页标题
  console.log($('head title').text());
});
```


## 结束

本章的内容主要讲解了关键的实现部分，对于一些相关的模块的详细使用方法，读者可以
自行访问该模块的主页来获取。要获取本章实例的完整代码可以访问以下网址获得：
https://github.com/leizongmin/book-crawler-mysql-cron

读者在阅读本章内容时遇到相关的问题，可以通过以下网址来提交：
https://github.com/leizongmin/book-crawler-mysql-cron/issues

--------------------------------------------------------------------------------

参考文献：

+ 《SQL注入》：http://baike.baidu.com/view/3896.htm
+ 《数据库连接池》：http://baike.baidu.com/view/84055.htm
+ 《Async详解之一：流程控制》：http://freewind.me/blog/20120515/917.html
+ 《Async详解之二：工具类》：http://freewind.me/blog/20120517/931.html
+ 《Async详解之三：集合操作》：http://freewind.me/blog/20120518/932.html
+ 《jsdoc-toolkit TagReference》：https://code.google.com/p/jsdoc-toolkit/wiki/TagReference
+ 《XSS注入和防范》：http://qdemo.sinaapp.com/ppt/xss/
+ 《segment fault 段异常各种原因》：http://www.myexception.cn/program/972764.html
+ 《crontab命令》：http://baike.baidu.com/view/1229061.htm
+ 《exec与spawn方法的区别与陷阱》：http://blog.csdn.net/bd_zengxinxin/article/details/9044989
+ 《UNICODE,GBK,UTF-8区别》：http://www.cnblogs.com/cy163/archive/2007/05/31/766886.html
+ 《NodeJS笔记：处理非utf8编码（续）》：http://nodejs.lofter.com/post/3c14e_48aee


[1]: images/1.png
[2]: images/2.png
[3]: images/3.png
[4]: images/4.png
[5]: images/5.png
[6]: images/6.png
[7]: images/7.png
[8]: images/8.png
[9]: images/9.png

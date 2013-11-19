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

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

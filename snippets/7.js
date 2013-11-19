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
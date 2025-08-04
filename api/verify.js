const express = require('express');
const app = express();

// 处理 JSONP 验证请求
app.get('/api/verify.js', (req, res) => {
  try {
    // 获取前端传递的参数
    const userPassword = req.query.password; // 用户输入的密码
    const callbackName = req.query.callback; // JSONP 回调函数名

    // 从环境变量获取正确的密码（需要在服务器配置此环境变量）
    const correctPassword = process.env.PASSWORD;

    // 验证密码
    let result;
    if (!correctPassword) {
      result = { success: false, message: '服务器未配置密码' };
    } else if (userPassword === correctPassword) {
      result = { success: true, message: '密码正确' };
    } else {
      result = { success: false, message: '密码错误' };
    }

    // 返回 JSONP 格式响应（必须用回调函数包裹，否则前端无法解析）
    res.setHeader('Content-Type', 'application/javascript');
    res.send(`${callbackName}(${JSON.stringify(result)})`);

  } catch (error) {
    // 错误处理
    res.setHeader('Content-Type', 'application/javascript');
    res.send(`${req.query.callback}(${JSON.stringify({
      success: false,
      message: '验证失败，请重试'
    })})`);
  }
});

// 启动服务器（监听 3000 端口，实际部署需根据服务器配置调整）
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`服务器运行在端口 ${port}`);
});
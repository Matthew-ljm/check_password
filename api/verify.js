const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();

// 中间件配置
app.use(cors()); // 允许跨域请求
app.use(bodyParser.json()); // 解析JSON请求体
app.use(bodyParser.urlencoded({ extended: true })); // 解析表单请求体

// 密码验证接口
app.post('/api/verify.js', (req, res) => {
    try {
        // 从环境变量获取正确密码
        const correctPassword = process.env.PASSWORD;
        
        // 检查环境变量是否配置
        if (!correctPassword) {
            return res.status(500).json({
                success: false,
                message: '服务器未配置密码'
            });
        }
        
        // 从请求中获取用户输入的密码
        const inputPassword = req.body.password || req.query.password;
        
        // 验证密码
        if (inputPassword === correctPassword) {
            res.json({
                success: true,
                message: '密码验证成功'
            });
        } else {
            res.json({
                success: false,
                message: '密码不正确'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '验证过程出错'
        });
    }
});

// 启动服务器
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`服务器运行在端口 ${port}`);
});
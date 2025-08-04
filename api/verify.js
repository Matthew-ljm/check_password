// 处理 GET 请求（支持 JSONP 跨域）
export default function handler(req, res) {
    try {
        // 只允许 GET 方法（JSONP 基于 GET）
        if (req.method !== 'GET') {
            return res.status(405).json({ success: false, message: '仅支持 GET 请求' });
        }

        // 获取请求参数
        const { password, callback } = req.query;
        const correctPassword = process.env.PASSWORD; // 从 Vercel 环境变量获取正确密码

        // 验证必要参数
        if (!password || !callback) {
            return res.status(400).json({ success: false, message: '参数不完整' });
        }

        // 验证密码
        let result;
        if (!correctPassword) {
            result = { success: false, message: '服务器未配置密码' };
        } else if (password === correctPassword) {
            result = { success: true, message: '密码正确' };
        } else {
            result = { success: false, message: '密码错误' };
        }

        // 输出 JSONP 格式响应（适配前端跨域）
        res.setHeader('Content-Type', 'application/javascript');
        res.send(`${callback}(${JSON.stringify(result)})`);

    } catch (error) {
        // 错误处理
        const { callback } = req.query;
        res.setHeader('Content-Type', 'application/javascript');
        res.send(`${callback || 'defaultCallback'}(${JSON.stringify({
            success: false,
            message: '验证失败，请重试'
        })})`);
    }
}
// 确保引入必要的模块
const { createClient } = require('@supabase/supabase-js');

// 初始化Supabase客户端（仅在后端使用）
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const validPassword = process.env.PASSWORD;

// 确保环境变量配置正确
if (!supabaseUrl || !supabaseKey || !validPassword) {
    // 即使环境变量缺失，也返回明确错误
    exports.default = async (req, res) => {
        res.status(500).json({ 
            success: false, 
            error: '服务器配置不完整，请联系管理员' 
        });
    };
    return;
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 主处理函数
exports.default = async (req, res) => {
    try {
        // 1. 仅允许POST请求
        if (req.method !== 'POST') {
            return res.status(405).json({ 
                success: false, 
                error: '仅支持POST请求' 
            });
        }

        // 2. 解析请求数据（处理可能的解析错误）
        let { password } = req.body;
        if (typeof password !== 'string') {
            return res.status(400).json({ 
                success: false, 
                error: '请提供有效的密码' 
            });
        }

        // 3. 获取客户端IP
        const clientIp = req.headers['x-forwarded-for'] || 
                         req.connection.remoteAddress || 
                         'unknown';

        // 4. 检查IP锁定状态
        const { data: existingRecord } = await supabase
            .from('login_attempts')
            .select('failed_attempts, locked_until')
            .eq('ip_address', clientIp)
            .single()
            .catch(() => ({ data: null }));

        // 处理锁定逻辑
        if (existingRecord && existingRecord.locked_until) {
            const now = new Date();
            const lockedUntil = new Date(existingRecord.locked_until);
            
            if (now < lockedUntil) {
                const minutesLeft = Math.ceil((lockedUntil - now) / (60 * 1000));
                return res.status(423).json({ 
                    success: false, 
                    error: `账户已锁定，请${minutesLeft}分钟后再试`,
                    locked: true,
                    minutesLeft
                });
            }
        }

        // 5. 验证密码
        if (password === validPassword) {
            // 密码正确：重置错误次数
            if (existingRecord) {
                await supabase
                    .from('login_attempts')
                    .update({
                        failed_attempts: 0,
                        locked_until: null,
                        updated_at: new Date()
                    })
                    .eq('ip_address', clientIp);
            }
            
            // 必须返回JSON响应
            return res.status(200).json({ 
                success: true, 
                message: '验证成功' 
            });
        } else {
            // 密码错误：更新错误次数
            const failedAttempts = (existingRecord?.failed_attempts || 0) + 1;
            let lockedUntil = null;
            
            if (failedAttempts >= 3) {
                lockedUntil = new Date(Date.now() + 60 * 60 * 1000); // 锁定1小时
            }

            // 更新记录
            if (existingRecord) {
                await supabase
                    .from('login_attempts')
                    .update({
                        failed_attempts: failedAttempts,
                        locked_until: lockedUntil,
                        updated_at: new Date()
                    })
                    .eq('ip_address', clientIp);
            } else {
                await supabase
                    .from('login_attempts')
                    .insert({
                        ip_address: clientIp,
                        failed_attempts: failedAttempts,
                        locked_until: lockedUntil
                    });
            }

            // 返回错误信息
            const errorMsg = failedAttempts >= 3 
                ? '连续3次密码错误，账户已锁定1小时' 
                : `密码错误，还剩${3 - failedAttempts}次尝试机会`;
                
            return res.status(failedAttempts >= 3 ? 423 : 401).json({ 
                success: false, 
                error: errorMsg,
                remainingAttempts: failedAttempts >= 3 ? 0 : 3 - failedAttempts,
                locked: failedAttempts >= 3
            });
        }

    } catch (error) {
        console.error('验证API错误:', error);
        // 确保异常情况下也返回响应
        return res.status(500).json({ 
            success: false, 
            error: '服务器验证过程出错，请稍后再试' 
        });
    }
};
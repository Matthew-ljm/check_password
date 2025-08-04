import { createClient } from '@supabase/supabase-js';

// 初始化Supabase客户端（仅在后端使用）
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('请配置Supabase环境变量');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
    // 仅允许POST请求
    if (req.method !== 'POST') {
        return res.status(405).json({ error: '仅支持POST请求' });
    }

    const { password } = req.body;
    const clientIp = req.headers.get('x-forwarded-for') || req.ip; // 获取用户IP
    const validPassword = process.env.PASSWORD;

    // 检查服务器是否配置密码
    if (!validPassword) {
        return res.status(500).json({ error: '服务器未配置密码' });
    }

    try {
        // 1. 检查该IP是否被锁定
        const { data: existingRecord } = await supabase
            .from('login_attempts')
            .select('failed_attempts, locked_until')
            .eq('ip_address', clientIp)
            .single()
            .catch(() => ({ data: null })); // 没有记录时返回null

        // 检查锁定状态（当前时间是否在锁定时间之前）
        if (existingRecord && existingRecord.locked_until) {
            const now = new Date();
            const lockedUntil = new Date(existingRecord.locked_until);
            
            if (now < lockedUntil) {
                const minutesLeft = Math.ceil((lockedUntil - now) / (60 * 1000));
                return res.status(423).json({ 
                    error: `账户已锁定，请${minutesLeft}分钟后再试`,
                    locked: true,
                    minutesLeft
                });
            }
        }

        // 2. 验证密码
        if (password === validPassword) {
            // 密码正确：重置错误次数和锁定状态
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
            
            return res.status(200).json({ success: true });
        } else {
            // 密码错误：更新错误次数，达到3次则锁定1小时
            const failedAttempts = (existingRecord?.failed_attempts || 0) + 1;
            let lockedUntil = null;
            
            if (failedAttempts >= 3) {
                // 锁定1小时
                lockedUntil = new Date(Date.now() + 60 * 60 * 1000);
            }

            // 插入或更新记录
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
            if (failedAttempts >= 3) {
                return res.status(423).json({ 
                    error: '连续3次密码错误，账户已锁定1小时',
                    locked: true,
                    minutesLeft: 60
                });
            } else {
                return res.status(401).json({ 
                    error: '密码错误',
                    remainingAttempts: 3 - failedAttempts
                });
            }
        }
    } catch (error) {
        console.error('Supabase操作错误:', error);
        return res.status(500).json({ error: '服务器验证失败' });
    }
}
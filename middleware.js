import { NextResponse } from 'next/server';

export default async function middleware(request) {
    const url = new URL(request.url);
    
    // 仅对验证API生效，其他路径直接放行
    if (url.pathname !== '/api/verify') {
        return NextResponse.next(); // 放行非目标路径
    }

    // 获取客户端IP（处理代理链中的多个IP）
    const xForwardedFor = request.headers.get('x-forwarded-for');
    let ip = 'unknown';
    if (xForwardedFor) {
        // 取第一个IP（最原始的客户端IP）
        ip = xForwardedFor.split(',')[0].trim();
    } else {
        ip = request.headers.get('x-real-ip') || 'unknown';
    }
               
    const now = Date.now();
    const RATE_LIMIT = 100; // 1小时最多100次请求
    const WINDOW_MS = 60 * 60 * 1000; // 1小时窗口（毫秒）

    // 从Cookie获取IP的请求记录
    const cacheKey = `rate_limit_${ip}`;
    let cached = null;
    const cookieHeader = request.headers.get('cookie');
    
    if (cookieHeader) {
        const cookies = cookieHeader.split(';');
        for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === cacheKey) {
                cached = value;
                break;
            }
        }
    }
    
    // 解析请求记录（默认空数组）
    const requests = cached ? JSON.parse(decodeURIComponent(cached)) : [];

    // 过滤过期记录（只保留1小时内的请求）
    const recentRequests = requests.filter(timestamp => timestamp > now - WINDOW_MS);

    // 超过限制则拦截
    if (recentRequests.length >= RATE_LIMIT) {
        return NextResponse.json(
            { error: '请求过于频繁，请1小时后再试' },
            { 
                status: 429,
                headers: { 'Cache-Control': 'no-store' }
            }
        );
    }

    // 更新请求记录并设置Cookie
    recentRequests.push(now);
    const response = NextResponse.next(); // 放行当前请求
    
    // 动态配置Cookie（开发环境不启用Secure）
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = [
        `${cacheKey}=${encodeURIComponent(JSON.stringify(recentRequests))}`,
        `Max-Age=${Math.floor(WINDOW_MS / 1000)}`, // 过期时间与窗口一致
        'HttpOnly', // 防止JS读取，增强安全
        isProduction ? 'Secure' : '', // 生产环境启用HTTPS安全标识
        'SameSite=Strict', // 限制跨站访问
        'Path=/'
    ].filter(Boolean).join('; '); // 过滤空值（开发环境的Secure）

    response.headers.set('Set-Cookie', cookieOptions);
    return response;
}

// 定义中间件适用的路径（仅/api/verify）
export const config = {
    matcher: '/api/verify'
};

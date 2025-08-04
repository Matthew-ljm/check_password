// 修正语法错误，移除多余的default关键字
export default async function middleware(request) {
    // 解析URL获取路径
    const url = new URL(request.url);
    
    // 仅对验证API生效
    if (url.pathname !== '/api/verify') {
        return new Response(null, { status: 200 });
    }

    // 获取客户端IP
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
               
    const now = Date.now();
    const RATE_LIMIT = 10; // 1小时最多10次请求
    const WINDOW_MS = 60 * 60 * 1000; // 1小时窗口

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
    
    const requests = cached ? JSON.parse(decodeURIComponent(cached)) : [];

    // 过滤过期记录
    const recentRequests = requests.filter(timestamp => timestamp > now - WINDOW_MS);

    // 超过限制则拦截
    if (recentRequests.length >= RATE_LIMIT) {
        return new Response(
            JSON.stringify({ error: '请求过于频繁，请1小时后再试' }),
            { 
                status: 429,
                headers: { 
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store'
                }
            }
        );
    }

    // 更新请求记录并设置Cookie
    recentRequests.push(now);
    const response = new Response(null, { status: 200 });
    response.headers.set(
        'Set-Cookie', 
        `${cacheKey}=${encodeURIComponent(JSON.stringify(recentRequests))}; ` +
        `Max-Age=${Math.floor(WINDOW_MS / 1000)}; ` +
        'HttpOnly; Secure; SameSite=Strict; Path=/'
    );

    return response;
}

// 定义中间件适用的路径
export const config = {
    matcher: '/api/verify'
};
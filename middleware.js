// 验证域名的中间件（限制API请求频率）
import { NextResponse } from 'next/server';

export function middleware(req) {
    // 仅对验证API生效
    if (req.nextUrl.pathname !== '/api/verify') {
        return NextResponse.next();
    }

    // 获取客户端IP
    const ip = req.headers.get('x-forwarded-for') || req.ip;
    const now = Date.now();
    const RATE_LIMIT = 10; // 1小时最多10次请求
    const WINDOW_MS = 60 * 60 * 1000; // 1小时窗口

    // 从边缘缓存获取IP的请求记录（Vercel免费版支持）
    const cacheKey = `rate_limit_${ip}`;
    const cached = req.cookies.get(cacheKey);
    const requests = cached ? JSON.parse(cached.value) : [];

    // 过滤过期记录
    const recentRequests = requests.filter(timestamp => timestamp > now - WINDOW_MS);

    // 超过限制则拦截
    if (recentRequests.length >= RATE_LIMIT) {
        return NextResponse.json(
            { error: '请求过于频繁，请1小时后再试' },
            { status: 429 }
        );
    }

    // 更新请求记录并设置缓存
    recentRequests.push(now);
    const response = NextResponse.next();
    response.cookies.set(cacheKey, JSON.stringify(recentRequests), {
        maxAge: WINDOW_MS / 1000, // 缓存1小时
        httpOnly: true,
        secure: true
    });

    return response;
}

// 仅对验证API生效
export const config = { matcher: '/api/verify' };
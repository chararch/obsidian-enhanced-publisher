/**
 * 微信主题样式枚举
 */
export enum WechatThemeStyle {
    MODERN_MINIMAL = 'modern-minimal',     // 简约
    TECH_FUTURE = 'tech-future',           // 科技
    WARM_ORANGE = 'warm-orange',           // 温暖
    FRESH_GREEN = 'fresh-green',           // 清新
    ELEGANT_VIOLET = 'elegant-violet',     // 优雅
    CHINESE_STYLE = 'chinese-style'        // 国风
}

/**
 * 微信主题颜色枚举
 */
export enum WechatThemeColor {
    CLASSIC_BLUE = 'classic-blue',       // 经典蓝 #3eaf7c
    EMERALD_GREEN = 'emerald-green',     // 翡翠绿 #42b983
    VIBRANT_ORANGE = 'vibrant-orange',   // 活力橘 #ff6b35
    LEMON_YELLOW = 'lemon-yellow',       // 柠檬黄 #f7ba2a
    LAVENDER_PURPLE = 'lavender-purple', // 薰衣紫 #9b59b6
    SKY_BLUE = 'sky-blue',               // 天空蓝 #3498db
    ROSE_GOLD = 'rose-gold',             // 玫瑰金 #e67e22
    OLIVE_GREEN = 'olive-green',         // 橄榄绿 #27ae60
    GRAPHITE_BLACK = 'graphite-black',   // 石墨黑 #2c3e50
    FOGGY_GRAY = 'foggy-gray',           // 雾烟灰 #95a5a6
    SAKURA_PINK = 'sakura-pink'          // 樱花粉 #e91e63
}

/**
 * 主题配置接口
 */
export interface ThemeConfig {
    style: WechatThemeStyle;
    color: WechatThemeColor;
}

/**
 * 主题颜色映射
 */
export const THEME_COLORS: Record<WechatThemeColor, string> = {
    [WechatThemeColor.CLASSIC_BLUE]: '#3eaf7c',
    [WechatThemeColor.EMERALD_GREEN]: '#42b983',
    [WechatThemeColor.VIBRANT_ORANGE]: '#ff6b35',
    [WechatThemeColor.LEMON_YELLOW]: '#f7ba2a',
    [WechatThemeColor.LAVENDER_PURPLE]: '#9b59b6',
    [WechatThemeColor.SKY_BLUE]: '#3498db',
    [WechatThemeColor.ROSE_GOLD]: '#e67e22',
    [WechatThemeColor.OLIVE_GREEN]: '#27ae60',
    [WechatThemeColor.GRAPHITE_BLACK]: '#2c3e50',
    [WechatThemeColor.FOGGY_GRAY]: '#95a5a6',
    [WechatThemeColor.SAKURA_PINK]: '#e91e63'
};

/**
 * 主题样式显示名称
 */
export const THEME_STYLE_NAMES: Record<WechatThemeStyle, string> = {
    [WechatThemeStyle.MODERN_MINIMAL]: '简约',
    [WechatThemeStyle.TECH_FUTURE]: '科技',
    [WechatThemeStyle.WARM_ORANGE]: '温暖',
    [WechatThemeStyle.FRESH_GREEN]: '清新',
    [WechatThemeStyle.ELEGANT_VIOLET]: '优雅',
    [WechatThemeStyle.CHINESE_STYLE]: '国风'
};

/**
 * 主题颜色显示名称
 */
export const THEME_COLOR_NAMES: Record<WechatThemeColor, string> = {
    [WechatThemeColor.CLASSIC_BLUE]: '经典蓝',
    [WechatThemeColor.EMERALD_GREEN]: '翡翠绿',
    [WechatThemeColor.VIBRANT_ORANGE]: '活力橘',
    [WechatThemeColor.LEMON_YELLOW]: '柠檬黄',
    [WechatThemeColor.LAVENDER_PURPLE]: '薰衣紫',
    [WechatThemeColor.SKY_BLUE]: '天空蓝',
    [WechatThemeColor.ROSE_GOLD]: '玫瑰金',
    [WechatThemeColor.OLIVE_GREEN]: '橄榄绿',
    [WechatThemeColor.GRAPHITE_BLACK]: '石墨黑',
    [WechatThemeColor.FOGGY_GRAY]: '雾烟灰',
    [WechatThemeColor.SAKURA_PINK]: '樱花粉'
};

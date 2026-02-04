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
 * 主题配置接口
 */
export interface ThemeConfig {
    style: WechatThemeStyle;
}

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

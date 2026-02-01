import { App } from 'obsidian';
import * as juice from 'juice';
import hljs from 'highlight.js';
import { Logger } from './logger';
import { ThemeConfig, WechatThemeStyle, WechatThemeColor, THEME_COLORS } from '../types/wechat-theme';

/**
 * 微信样式应用工具
 * 将 CSS 样式内联到 HTML 中，优化微信公众号显示效果
 * 支持多种主题样式和颜色
 */
export class WechatStyler {
    private app: App;
    private logger: Logger;
    private themeConfig: ThemeConfig;

    constructor(app: App, themeConfig?: ThemeConfig) {
        this.app = app;
        this.logger = Logger.getInstance(app);
        this.themeConfig = themeConfig || {
            style: WechatThemeStyle.MODERN_MINIMAL,
            color: WechatThemeColor.CLASSIC_BLUE
        };
    }

    /**
     * 获取主题 CSS
     */
    private getThemeCSS(): string {
        let baseCSS = '';

        // 根据主题样式选择对应的 CSS
        switch (this.themeConfig.style) {
            case WechatThemeStyle.MODERN_MINIMAL:
                baseCSS = this.getModernMinimalCSS();
                break;
            case WechatThemeStyle.TECH_FUTURE:
                baseCSS = this.getTechFutureCSS();
                break;
            case WechatThemeStyle.WARM_ORANGE:
                baseCSS = this.getWarmOrangeCSS();
                break;
            case WechatThemeStyle.FRESH_GREEN:
                baseCSS = this.getFreshGreenCSS();
                break;
            case WechatThemeStyle.ELEGANT_VIOLET:
                baseCSS = this.getElegantVioletCSS();
                break;
            case WechatThemeStyle.CHINESE_STYLE:
                baseCSS = this.getChineseStyleCSS();
                break;
            default:
                baseCSS = this.getModernMinimalCSS();
        }

        // 替换主题颜色变量
        const themeColor = THEME_COLORS[this.themeConfig.color];
        const replacedCSS = baseCSS.replace(/var\(--theme-color,\s*#[0-9a-fA-F]{6}\)/g, themeColor);

        // 添加 highlight.js 语法高亮样式
        return replacedCSS + '\n' + this.getHighlightJSCSS();
    }

    /**
     * 获取 highlight.js 语法高亮 CSS
     */
    private getHighlightJSCSS(): string {
        return `
/* Highlight.js 语法高亮样式 */
.hljs { display: block; overflow-x: auto; }
.hljs-comment, .hljs-quote { color: #5c6370; font-style: italic; }
.hljs-doctag, .hljs-keyword, .hljs-formula { color: #c678dd; }
.hljs-section, .hljs-name, .hljs-selector-tag, .hljs-deletion, .hljs-subst { color: #e06c75; }
.hljs-literal { color: #56b6c2; }
.hljs-string, .hljs-regexp, .hljs-addition, .hljs-attribute, .hljs-meta-string { color: #98c379; }
.hljs-built_in, .hljs-class .hljs-title { color: #e6c07b; }
.hljs-attr, .hljs-variable, .hljs-template-variable, .hljs-type, .hljs-selector-class, .hljs-selector-attr, .hljs-selector-pseudo, .hljs-number { color: #d19a66; }
.hljs-symbol, .hljs-bullet, .hljs-link, .hljs-meta, .hljs-selector-id, .hljs-title { color: #61aeee; }
.hljs-emphasis { font-style: italic; }
.hljs-strong { font-weight: bold; }
.hljs-link { text-decoration: underline; }

/* Mermaid 图表样式 */
.mermaid { 
    display: block !important; 
    text-align: center !important; 
    margin: 20px 0 !important; 
    overflow-x: auto !important;
    visibility: visible !important;
    opacity: 1 !important;
}
.mermaid svg, pre svg { 
    max-width: 100% !important; 
    height: auto !important; 
    display: inline-block !important;
    visibility: visible !important;
    opacity: 1 !important;
}
pre.mermaid {
    background-color: transparent !important;
    border: none !important;
    padding: 0 !important;
}

/* 数学公式样式 */
.math, .math-inline, .math-block, mjx-container {
    display: inline-block !important;
    visibility: visible !important;
    opacity: 1 !important;
    color: inherit !important;
}
.math-block {
    display: block !important;
    text-align: center !important;
    margin: 1em 0 !important;
}

/* Ruby 注音样式 */
ruby {
    ruby-align: center;
    display: inline-flex;
    flex-direction: column-reverse;
}
rt {
    font-size: 0.6em;
    line-height: 1.2;
    text-align: center;
}
        `;
    }

    /**
     * 获取经典主题 CSS
     */
    /**
     * 获取现代简约主题 CSS
     */
    private getModernMinimalCSS(): string {
        return `
.wechat-content {
  font-size: 16px;
  color: #3f3f3f;
  line-height: 1.75;
  letter-spacing: 0.05em;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
}
.wechat-content h1, .wechat-content h2, .wechat-content h3, .wechat-content h4, .wechat-content h5, .wechat-content h6 {
  margin-top: 30px; margin-bottom: 15px; padding: 0; font-weight: bold; color: #2b2b2b;
}
.wechat-content h1 { font-size: 24px; padding-bottom: 8px; border-bottom: 1px solid var(--theme-color, #3eaf7c); color: #2b2b2b; }
.wechat-content h2 { font-size: 22px; padding: 8px 12px; background-color: #f8f8f8; color: var(--theme-color, #3eaf7c); border: none; }
.wechat-content h3 { font-size: 20px; padding-left: 10px; border-left: 2px solid var(--theme-color, #3eaf7c); }
.wechat-content h4 { font-size: 18px; }
.wechat-content h5 { font-size: 16px; }
.wechat-content h6 { font-size: 16px; color: #777; }
.wechat-content p { margin: 15px 0; line-height: 1.75; }
.wechat-content a { color: var(--theme-color, #3eaf7c); text-decoration: none; border-bottom: 1px solid var(--theme-color, #3eaf7c); }
.wechat-content ul, .wechat-content ol { margin: 15px 0; padding-left: 30px; }
.wechat-content li { margin: 8px 0; line-height: 1.75; }
.wechat-content blockquote { margin: 20px 0; padding: 15px 20px; background-color: #f8f8f8; border-left: 3px solid var(--theme-color, #3eaf7c); color: #666; font-style: italic; }
.wechat-content blockquote p { margin: 0; }
.wechat-content pre { margin: 20px 0; padding: 15px; background-color: #f5f5f5; border-radius: 3px; overflow-x: auto; border: 1px solid #e0e0e0; }
.wechat-content code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace; font-size: 14px; background-color: #f0f0f0; padding: 2px 6px; border-radius: 3px; color: #d73a49; }
.wechat-content pre code { display: block; padding: 0; background-color: transparent; color: #333; line-height: 1.5; }
.wechat-content table { margin: 20px 0; border-collapse: collapse; width: 100%; font-size: 14px; }
.wechat-content table th, .wechat-content table td { padding: 10px 15px; border: 1px solid #dfe2e5; text-align: left; }
.wechat-content table th { background-color: #f6f8fa; font-weight: bold; color: #2b2b2b; }
.wechat-content table tr:nth-child(even) { background-color: #f8f8f8; }
.wechat-content hr { margin: 30px 0; border: none; border-top: 1px solid #eee; }
.wechat-content img { max-width: 100%; height: auto; display: block; margin: 20px auto; border-radius: 3px; }
.wechat-content strong { font-weight: bold; color: #2b2b2b; }
.wechat-content em { font-style: italic; }
.wechat-content del { text-decoration: line-through; color: #999; }
.wechat-content mark { background-color: var(--theme-color, #3eaf7c); color: #ffffff; padding: 2px 4px; border-radius: 2px; }
        `;
    }

    /**
     * 获取科技未来主题 CSS
     */
    private getTechFutureCSS(): string {
        return `
.wechat-content {
  font-size: 16px;
  color: #1a202c;
  line-height: 1.75;
  letter-spacing: 0.05em;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
  background: linear-gradient(180deg, #f7fafc 0%, #edf2f7 100%);
}
.wechat-content h1, .wechat-content h2, .wechat-content h3, .wechat-content h4, .wechat-content h5, .wechat-content h6 {
  margin-top: 30px; margin-bottom: 15px; padding: 0; font-weight: bold; color: #0f172a;
}
.wechat-content h1 { font-size: 24px; padding: 15px 25px; background: linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%); color: #ffffff; border: none; border-radius: 8px; box-shadow: 0 4px 20px rgba(139, 92, 246, 0.5), 0 0 30px rgba(6, 182, 212, 0.4); text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3); }
.wechat-content h2 { font-size: 22px; padding: 12px 20px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(6, 182, 212, 0.1) 100%); border-left: 5px solid; border-image: linear-gradient(to bottom, #06b6d4, #8b5cf6) 1; border-radius: 0 6px 6px 0; box-shadow: 0 2px 15px rgba(139, 92, 246, 0.25); }
.wechat-content h3 { font-size: 20px; padding-left: 15px; border-left: 4px solid #06b6d4; box-shadow: -4px 0 12px rgba(6, 182, 212, 0.4); }
.wechat-content h4 { font-size: 18px; color: #0891b2; }
.wechat-content h5 { font-size: 16px; }
.wechat-content h6 { font-size: 16px; color: #777; }
.wechat-content p { margin: 15px 0; line-height: 1.75; }
.wechat-content a { color: #0891b2; text-decoration: none; border-bottom: 2px solid transparent; background: linear-gradient(to right, #06b6d4, #8b5cf6); background-size: 0% 2px; background-repeat: no-repeat; background-position: left bottom; transition: background-size 0.3s ease; }
.wechat-content ul, .wechat-content ol { margin: 15px 0; padding-left: 30px; }
.wechat-content li { margin: 8px 0; line-height: 1.75; }
.wechat-content blockquote { margin: 20px 0; padding: 15px 20px; background: linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%); border-left: 5px solid; border-image: linear-gradient(to bottom, #06b6d4, #8b5cf6) 1; color: #475569; font-style: italic; border-radius: 0 8px 8px 0; box-shadow: 0 2px 10px rgba(6, 182, 212, 0.15); }
.wechat-content blockquote p { margin: 0; }
.wechat-content pre { margin: 20px 0; padding: 20px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 8px; overflow-x: auto; border: 1px solid #06b6d4; box-shadow: 0 4px 25px rgba(0, 0, 0, 0.5), 0 0 30px rgba(6, 182, 212, 0.3), inset 0 1px 0 rgba(6, 182, 212, 0.2); }
.wechat-content code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace; font-size: 14px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(6, 182, 212, 0.15)); padding: 3px 8px; border-radius: 4px; color: #0891b2; border: 1px solid rgba(6, 182, 212, 0.3); }
.wechat-content pre code { display: block; padding: 0; background-color: transparent; color: #cbd5e1; line-height: 1.6; border: none; }
.wechat-content table { margin: 20px 0; border-collapse: collapse; width: 100%; font-size: 14px; }
.wechat-content table th, .wechat-content table td { padding: 10px 15px; border: 1px solid #dfe2e5; text-align: left; }
.wechat-content table th { background: linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%); font-weight: bold; color: #ffffff; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4); }
.wechat-content table tr:nth-child(even) { background-color: #f8f8f8; }
.wechat-content hr { margin: 30px 0; border: none; height: 2px; background: linear-gradient(90deg, transparent, #06b6d4, #8b5cf6, transparent); }
.wechat-content img { max-width: 100%; height: auto; display: block; margin: 20px auto; border-radius: 8px; box-shadow: 0 4px 20px rgba(139, 92, 246, 0.25); border: 1px solid rgba(6, 182, 212, 0.2); }
.wechat-content strong { font-weight: bold; color: #0f172a; background: linear-gradient(135deg, rgba(6, 182, 212, 0.1), rgba(139, 92, 246, 0.1)); padding: 0 4px; border-radius: 2px; }
.wechat-content em { font-style: italic; }
.wechat-content del { text-decoration: line-through; color: #999; }
.wechat-content mark { background: linear-gradient(135deg, #06b6d4, #8b5cf6); color: #ffffff; padding: 3px 8px; border-radius: 4px; box-shadow: 0 2px 12px rgba(139, 92, 246, 0.5), 0 0 20px rgba(6, 182, 212, 0.3); }
        `;
    }

    /**
     * 获取温暖橙光主题 CSS
     */
    private getWarmOrangeCSS(): string {
        return `
.wechat-content {
  font-size: 16px;
  color: #3f3f3f;
  line-height: 1.75;
  letter-spacing: 0.05em;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
}
.wechat-content h1, .wechat-content h2, .wechat-content h3, .wechat-content h4, .wechat-content h5, .wechat-content h6 {
  margin-top: 30px; margin-bottom: 15px; padding: 0; font-weight: bold; color: #2b2b2b;
}
.wechat-content h1 { font-size: 24px; padding: 12px 20px; background-color: #ff6b35; color: #ffffff; border: none; }
.wechat-content h2 { font-size: 22px; padding: 10px 16px; padding-left: 20px; background-color: #fff3ed; border-left: 4px solid #ff6b35; color: #ff6b35; }
.wechat-content h3 { font-size: 20px; padding-left: 12px; border-left: 4px solid #ff6b35; }
.wechat-content h4 { font-size: 18px; }
.wechat-content h5 { font-size: 16px; }
.wechat-content h6 { font-size: 16px; color: #777; }
.wechat-content p { margin: 15px 0; line-height: 1.75; }
.wechat-content a { color: #ff6b35; text-decoration: none; border-bottom: 1px solid #ff6b35; }
.wechat-content ul, .wechat-content ol { margin: 15px 0; padding-left: 30px; }
.wechat-content li { margin: 8px 0; line-height: 1.75; }
.wechat-content blockquote { margin: 20px 0; padding: 15px 20px; background-color: #fff3ed; border-left: 4px solid #ff6b35; color: #666; font-style: italic; }
.wechat-content blockquote p { margin: 0; }
.wechat-content pre { margin: 20px 0; padding: 15px; background-color: #2c2c2c; border-radius: 5px; overflow-x: auto; border: none; }
.wechat-content code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace; font-size: 14px; background-color: #fff3ed; padding: 2px 6px; border-radius: 3px; color: #ff6b35; }
.wechat-content pre code { display: block; padding: 0; background-color: transparent; color: #abb2bf; line-height: 1.5; }
.wechat-content table { margin: 20px 0; border-collapse: collapse; width: 100%; font-size: 14px; }
.wechat-content table th, .wechat-content table td { padding: 10px 15px; border: 1px solid #dfe2e5; text-align: left; }
.wechat-content table th { background-color: #ff6b35; font-weight: bold; color: #ffffff; }
.wechat-content table tr:nth-child(even) { background-color: #fff3ed; }
.wechat-content hr { margin: 30px 0; border: none; border-top: 1px solid #eee; }
.wechat-content img { max-width: 100%; height: auto; display: block; margin: 20px auto; border-radius: 5px; }
.wechat-content strong { font-weight: bold; color: #2b2b2b; }
.wechat-content em { font-style: italic; }
.wechat-content del { text-decoration: line-through; color: #999; }
.wechat-content mark { background-color: #ff6b35; color: #ffffff; padding: 2px 4px; border-radius: 2px; }
        `;
    }

    /**
     * 获取清新绿意主题 CSS
     */
    private getFreshGreenCSS(): string {
        return `
.wechat-content {
  font-size: 16px;
  color: #3f3f3f;
  line-height: 1.75;
  letter-spacing: 0.05em;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
}
.wechat-content h1, .wechat-content h2, .wechat-content h3, .wechat-content h4, .wechat-content h5, .wechat-content h6 {
  margin-top: 30px; margin-bottom: 15px; padding: 0; font-weight: bold; color: #2b2b2b;
}
.wechat-content h1 { font-size: 24px; padding-bottom: 12px; border-bottom: 3px solid #42b983; color: #2b2b2b; text-align: center; }
.wechat-content h2 { font-size: 22px; padding: 10px 16px; background: linear-gradient(to right, #42b983 0%, #85d7b3 100%); color: #ffffff; border: none; border-radius: 4px; }
.wechat-content h3 { font-size: 20px; padding-left: 12px; border-left: 4px solid #42b983; }
.wechat-content h4 { font-size: 18px; }
.wechat-content h5 { font-size: 16px; }
.wechat-content h6 { font-size: 16px; color: #777; }
.wechat-content p { margin: 15px 0; line-height: 1.75; }
.wechat-content a { color: #42b983; text-decoration: none; border-bottom: 1px solid #42b983; }
.wechat-content ul, .wechat-content ol { margin: 15px 0; padding-left: 30px; }
.wechat-content li { margin: 8px 0; line-height: 1.75; }
.wechat-content blockquote { margin: 20px 0; padding: 15px 20px; background-color: #f0faf6; border-left: 4px solid #42b983; color: #666; font-style: italic; }
.wechat-content blockquote p { margin: 0; }
.wechat-content pre { margin: 20px 0; padding: 15px; background-color: #2c2c2c; border-radius: 5px; overflow-x: auto; border: none; }
.wechat-content code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace; font-size: 14px; background-color: #f0faf6; padding: 2px 6px; border-radius: 3px; color: #42b983; }
.wechat-content pre code { display: block; padding: 0; background-color: transparent; color: #abb2bf; line-height: 1.5; }
.wechat-content table { margin: 20px 0; border-collapse: collapse; width: 100%; font-size: 14px; }
.wechat-content table th, .wechat-content table td { padding: 10px 15px; border: 1px solid #dfe2e5; text-align: left; }
.wechat-content table th { background-color: #42b983; font-weight: bold; color: #ffffff; }
.wechat-content table tr:nth-child(even) { background-color: #f0faf6; }
.wechat-content hr { margin: 30px 0; border: none; border-top: 1px solid #eee; }
.wechat-content img { max-width: 100%; height: auto; display: block; margin: 20px auto; border-radius: 5px; }
.wechat-content strong { font-weight: bold; color: #2b2b2b; }
.wechat-content em { font-style: italic; }
.wechat-content del { text-decoration: line-through; color: #999; }
.wechat-content mark { background-color: #42b983; color: #ffffff; padding: 2px 4px; border-radius: 2px; }
        `;
    }

    /**
     * 获取优雅紫罗兰主题 CSS
     */
    private getElegantVioletCSS(): string {
        return `
.wechat-content {
  font-size: 16px;
  color: #3f3f3f;
  line-height: 1.75;
  letter-spacing: 0.05em;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
}
.wechat-content h1, .wechat-content h2, .wechat-content h3, .wechat-content h4, .wechat-content h5, .wechat-content h6 {
  margin-top: 30px; margin-bottom: 15px; padding: 0; font-weight: bold; color: #2b2b2b;
}
.wechat-content h1 { font-size: 24px; padding-bottom: 12px; border-bottom: 3px solid #9b59b6; color: #2b2b2b; text-align: center; font-weight: 600; }
.wechat-content h2 { font-size: 22px; padding: 10px 16px; background: linear-gradient(135deg, #9b59b6 0%, #c39bd3 100%); color: #ffffff; border: none; border-radius: 4px; box-shadow: 0 2px 8px rgba(155, 89, 182, 0.3); }
.wechat-content h3 { font-size: 20px; padding-left: 12px; border-left: 4px solid #9b59b6; }
.wechat-content h4 { font-size: 18px; }
.wechat-content h5 { font-size: 16px; }
.wechat-content h6 { font-size: 16px; color: #777; }
.wechat-content p { margin: 15px 0; line-height: 1.75; }
.wechat-content a { color: #9b59b6; text-decoration: none; border-bottom: 1px solid #9b59b6; }
.wechat-content ul, .wechat-content ol { margin: 15px 0; padding-left: 30px; }
.wechat-content li { margin: 8px 0; line-height: 1.75; }
.wechat-content blockquote { margin: 20px 0; padding: 15px 20px; background-color: #f8f5fb; border-left: 4px solid #9b59b6; color: #666; font-style: italic; }
.wechat-content blockquote p { margin: 0; }
.wechat-content pre { margin: 20px 0; padding: 15px; background-color: #2d2438; border-radius: 5px; overflow-x: auto; border: none; }
.wechat-content code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace; font-size: 14px; background-color: #f8f5fb; padding: 2px 6px; border-radius: 3px; color: #9b59b6; }
.wechat-content pre code { display: block; padding: 0; background-color: transparent; color: #c9a7d8; line-height: 1.5; }
.wechat-content table { margin: 20px 0; border-collapse: collapse; width: 100%; font-size: 14px; }
.wechat-content table th, .wechat-content table td { padding: 10px 15px; border: 1px solid #dfe2e5; text-align: left; }
.wechat-content table th { background-color: #9b59b6; font-weight: bold; color: #ffffff; }
.wechat-content table tr:nth-child(even) { background-color: #f8f5fb; }
.wechat-content hr { margin: 30px 0; border: none; border-top: 1px solid #eee; }
.wechat-content img { max-width: 100%; height: auto; display: block; margin: 20px auto; border-radius: 5px; }
.wechat-content strong { font-weight: bold; color: #2b2b2b; }
.wechat-content em { font-style: italic; }
.wechat-content del { text-decoration: line-through; color: #999; }
.wechat-content mark { background-color: #9b59b6; color: #ffffff; padding: 2px 4px; border-radius: 2px; }
        `;
    }

    /**
     * 获取中国风主题 CSS
     */
    private getChineseStyleCSS(): string {
        return `
.wechat-content {
  font-size: 16px;
  color: #2c2c2c;
  line-height: 1.8;
  letter-spacing: 0.05em;
  font-family: "STSong", "SimSun", "Songti SC", "NSimSun", serif, -apple-system, BlinkMacSystemFont;
}
.wechat-content h1, .wechat-content h2, .wechat-content h3, .wechat-content h4, .wechat-content h5, .wechat-content h6 {
  margin-top: 30px; margin-bottom: 15px; padding: 0; font-weight: bold; color: #2c2c2c;
}
.wechat-content h1 { font-size: 24px; padding: 16px 30px; background: linear-gradient(to bottom, #f5e6d3 0%, #efe0c8 50%, #f5e6d3 100%); color: #c8161d; border: none; text-align: center; letter-spacing: 0.15em; position: relative; border-top: 2px solid #c8161d; border-bottom: 2px solid #c8161d; box-shadow: inset 0 1px 0 rgba(200, 22, 29, 0.3), inset 0 -1px 0 rgba(200, 22, 29, 0.3); }
.wechat-content h1::before, .wechat-content h1::after { content: '◈'; position: absolute; top: 50%; transform: translateY(-50%); color: #c8161d; font-size: 18px; }
.wechat-content h1::before { left: 8px; }
.wechat-content h1::after { right: 8px; }
.wechat-content h2 { font-size: 22px; padding: 10px 20px; border-left: 4px solid #c8161d; color: #c8161d; position: relative; background: linear-gradient(to right, rgba(200, 22, 29, 0.05) 0%, transparent 100%); }
.wechat-content h3 { font-size: 20px; padding-left: 12px; border-left: 3px solid #c8161d; }
.wechat-content h4 { font-size: 18px; }
.wechat-content h5 { font-size: 16px; }
.wechat-content h6 { font-size: 16px; color: #777; }
.wechat-content p { margin: 15px 0; line-height: 1.8; }
.wechat-content a { color: #c8161d; text-decoration: none; border-bottom: 1px solid #c8161d; }
.wechat-content ul, .wechat-content ol { margin: 15px 0; padding-left: 30px; }
.wechat-content li { margin: 8px 0; line-height: 1.8; }
.wechat-content blockquote { margin: 20px 0; padding: 15px 20px; background: linear-gradient(to right, #faf8f3 0%, #f5f0e8 100%); border-left: 4px solid #c8161d; border-right: 4px solid #c8161d; color: #666; font-style: normal; position: relative; }
.wechat-content blockquote::before { content: '"'; position: absolute; left: 8px; top: 5px; font-size: 32px; color: rgba(200, 22, 29, 0.2); font-family: Georgia, serif; line-height: 1; }
.wechat-content blockquote::after { content: '"'; position: absolute; right: 8px; bottom: 5px; font-size: 32px; color: rgba(200, 22, 29, 0.2); font-family: Georgia, serif; line-height: 1; }
.wechat-content blockquote p { margin: 0; }
.wechat-content pre { margin: 20px 0; padding: 15px; background-color: #2c2c2c; border-radius: 3px; overflow-x: auto; border: 1px solid #c8161d; }
.wechat-content code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace; font-size: 14px; background-color: #faf8f3; padding: 2px 6px; border-radius: 3px; color: #c8161d; }
.wechat-content pre code { display: block; padding: 0; background-color: transparent; color: #abb2bf; line-height: 1.5; }
.wechat-content table { margin: 20px 0; border-collapse: collapse; width: 100%; font-size: 14px; }
.wechat-content table th, .wechat-content table td { padding: 10px 15px; border: 1px solid #dfe2e5; text-align: left; }
.wechat-content table th { background-color: #c8161d; font-weight: bold; color: #ffffff; }
.wechat-content table tr:nth-child(even) { background-color: #faf8f3; }
.wechat-content hr { margin: 30px 0; border: none; height: 1px; background: linear-gradient(to right, transparent, #c8161d, transparent); position: relative; }
.wechat-content hr::after { content: '❖'; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); background-color: #ffffff; color: #c8161d; padding: 0 10px; font-size: 14px; }
.wechat-content img { max-width: 100%; height: auto; display: block; margin: 20px auto; border-radius: 3px; }
.wechat-content strong { font-weight: bold; color: #c8161d; position: relative; padding: 0 2px; }
.wechat-content strong::after { content: ''; position: absolute; bottom: 2px; left: 0; right: 0; height: 3px; background: linear-gradient(to right, transparent, rgba(200, 22, 29, 0.2), transparent); }
.wechat-content em { font-style: italic; }
.wechat-content del { text-decoration: line-through; color: #999; }
.wechat-content mark { background-color: #c8161d; color: #ffffff; padding: 2px 4px; border-radius: 2px; }
        `;
    }

    /**
     * 应用代码高亮
     */
    private applyCodeHighlighting(html: string): string {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // 查找所有代码块
            const codeBlocks = doc.querySelectorAll('pre code');

            codeBlocks.forEach(block => {
                const codeElement = block as HTMLElement;
                const preElement = codeElement.parentElement;

                // 跳过包含图表或 SVG 的代码块
                if (preElement) {
                    const hasSVG = preElement.querySelector('svg') !== null;
                    const isDiagram = preElement.classList.contains('mermaid') ||
                        preElement.classList.contains('plantuml') ||
                        preElement.querySelector('.mermaid') !== null ||
                        preElement.querySelector('.plantuml') !== null;

                    if (hasSVG || isDiagram) {
                        return; // 跳过这个代码块
                    }
                }

                const code = codeElement.textContent || '';

                // 尝试自动检测语言并高亮
                try {
                    const result = hljs.highlightAuto(code);
                    codeElement.innerHTML = result.value;
                    codeElement.classList.add('hljs');
                } catch (error) {
                    this.logger.debug('代码高亮失败:', error);
                }
            });

            const serializer = new XMLSerializer();
            return serializer.serializeToString(doc.body);
        } catch (error) {
            this.logger.error('应用代码高亮时出错:', error);
            return html;
        }
    }

    /**
     * 为中国风主题添加装饰元素
     * 因为 CSS 伪元素无法被 juice 内联化，所以需要插入真实的 HTML 元素
     */
    private addChineseStyleDecorations(htmlContent: string): string {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');

        // 1. H1 标题 - 添加左右装饰符号
        doc.querySelectorAll('.wechat-content h1').forEach(h1 => {
            const leftDecor = doc.createElement('span');
            leftDecor.textContent = '◈';
            leftDecor.style.cssText = 'position: absolute; left: 8px; top: 50%; transform: translateY(-50%); color: #c8161d; font-size: 18px;';

            const rightDecor = doc.createElement('span');
            rightDecor.textContent = '◈';
            rightDecor.style.cssText = 'position: absolute; right: 8px; top: 50%; transform: translateY(-50%); color: #c8161d; font-size: 18px;';

            h1.insertBefore(leftDecor, h1.firstChild);
            h1.appendChild(rightDecor);
        });

        // 3. Blockquote - 添加引号
        doc.querySelectorAll('.wechat-content blockquote').forEach(bq => {
            const leftQuote = doc.createElement('span');
            leftQuote.textContent = '"';
            leftQuote.style.cssText = 'position: absolute; left: 8px; top: 5px; font-size: 32px; color: rgba(200, 22, 29, 0.2); font-family: Georgia, serif; line-height: 1;';

            const rightQuote = doc.createElement('span');
            rightQuote.textContent = '"';
            rightQuote.style.cssText = 'position: absolute; right: 8px; bottom: 5px; font-size: 32px; color: rgba(200, 22, 29, 0.2); font-family: Georgia, serif; line-height: 1;';

            bq.insertBefore(leftQuote, bq.firstChild);
            bq.appendChild(rightQuote);
        });

        // 4. HR - 添加中心装饰（HR 是自闭合标签，需要用包装器）
        doc.querySelectorAll('.wechat-content hr').forEach(hr => {
            const wrapper = doc.createElement('div');
            wrapper.style.cssText = 'position: relative; margin: 30px 0; text-align: center;';

            const decor = doc.createElement('span');
            decor.textContent = '❖';
            decor.style.cssText = 'display: inline-block; background-color: #ffffff; color: #c8161d; padding: 0 10px; font-size: 14px; position: relative; z-index: 1;';

            // 将 hr 的样式移到包装器中的伪线条
            const line = doc.createElement('div');
            line.style.cssText = 'position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: linear-gradient(to right, transparent, #c8161d, transparent);';

            if (hr.parentElement) {
                hr.parentElement.insertBefore(wrapper, hr);
                wrapper.appendChild(line);
                wrapper.appendChild(decor);
                hr.remove();
            }
        });

        // 5. Strong - 添加底部装饰线
        doc.querySelectorAll('.wechat-content strong').forEach(strong => {
            const underline = doc.createElement('span');
            underline.style.cssText = 'position: absolute; bottom: 2px; left: 0; right: 0; height: 3px; background: linear-gradient(to right, transparent, rgba(200, 22, 29, 0.2), transparent); display: block;';

            strong.appendChild(underline);
        });

        const serializer = new XMLSerializer();
        return serializer.serializeToString(doc.body);
    }

    /**
     * 应用微信样式到 HTML 内容
     * @param htmlContent 原始 HTML 内容
     * @returns 应用样式后的 HTML 内容
     */
    public applyWechatStyle(htmlContent: string): string {
        try {
            // 1. 获取主题 CSS
            const themeCSS = this.getThemeCSS();

            // 2. 包装内容到 wechat-content 容器中
            const wrappedContent = `<div class="wechat-content">${htmlContent}</div>`;

            // 3. 应用代码高亮
            const highlightedContent = this.applyCodeHighlighting(wrappedContent);

            // 4. 为中国风主题添加装饰元素（必须在 juice 之前）
            const decoratedContent = this.themeConfig.style === WechatThemeStyle.CHINESE_STYLE
                ? this.addChineseStyleDecorations(highlightedContent)
                : highlightedContent;

            // 保护特殊元素（Mermaid, SVG, Math等）不被 juice 处理
            const protectedMap = new Map<string, string>();
            let protectionId = 0;

            const protectContent = (html: string): string => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');

                // 查找所有需要保护的元素
                let elementsToProtect: Element[] = [];

                // 1. SVG
                doc.querySelectorAll('svg').forEach(el => elementsToProtect.push(el));

                // 2. Mermaid divs
                doc.querySelectorAll('.mermaid, [class*="mermaid"]').forEach(el => elementsToProtect.push(el));

                // 3. Math elements
                doc.querySelectorAll('.math, .math-inline, .math-block, mjx-container').forEach(el => elementsToProtect.push(el));

                // 4. Diagram pre blocks
                doc.querySelectorAll('pre').forEach(pre => {
                    if (pre.querySelector('svg') ||
                        pre.classList.contains('mermaid')) {
                        elementsToProtect.push(pre);
                    }
                });

                // 关键一步：过滤掉嵌套的元素，只保留最外层的元素
                elementsToProtect = elementsToProtect.filter((elA) => {
                    const isNested = elementsToProtect.some((elB) => {
                        return elA !== elB && elB.contains(elA);
                    });
                    return !isNested;
                });

                // 替换为占位符
                const serializer = new XMLSerializer();
                elementsToProtect.forEach(el => {
                    if (!el.parentElement) return;

                    const id = `__WECHAT_PROTECTED_${protectionId++}__`;
                    const content = serializer.serializeToString(el);
                    protectedMap.set(id, content);

                    const placeholder = doc.createElement('div');
                    placeholder.id = id;
                    placeholder.className = 'wechat-protected-placeholder';
                    placeholder.setAttribute('style', 'display: none;');

                    el.parentElement.replaceChild(placeholder, el);
                });

                return serializer.serializeToString(doc.body);
            };

            const contentToInline = protectContent(decoratedContent);

            // 4. 使用 juice 将 CSS 内联到 HTML 中
            const inlineResult = juice.inlineContent(contentToInline, themeCSS, {
                applyStyleTags: true,
                removeStyleTags: true,
                preserveMediaQueries: false,
                preserveFontFaces: false,
            });

            // 还原受保护的内容
            let styledContent = inlineResult;

            protectedMap.forEach((content, id) => {
                const regex = new RegExp(`<div[^>]*id="${id}"[^>]*></div>|<div[^>]*id="${id}"[^>]*/>`, 'g');

                if (!regex.test(styledContent)) {
                    const idRegex = new RegExp(`<div[^>]*id="${id}"[^>]*>.*?</div>`, 's');
                    if (idRegex.test(styledContent)) {
                        styledContent = styledContent.replace(idRegex, content);
                    }
                } else {
                    styledContent = styledContent.replace(regex, content);
                }
            });

            // 移除外层的 wechat-content div
            const outerDivRegex = /^<div class="wechat-content">([\s\S]*)<\/div>$/;
            const match = styledContent.match(outerDivRegex);
            if (match) {
                return match[1];
            }

            return styledContent;
        } catch (error) {
            this.logger.error('应用微信样式时出错:', error);
            return htmlContent;
        }
    }
}

/**
 * 应用微信样式的便捷函数
 */
export function applyWechatStyle(htmlContent: string, app: App, themeConfig?: ThemeConfig): string {
    const styler = new WechatStyler(app, themeConfig);
    return styler.applyWechatStyle(htmlContent);
}

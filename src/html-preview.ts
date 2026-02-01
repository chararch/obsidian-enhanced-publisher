import { App, MarkdownRenderer, MarkdownView, Notice, Modal, Plugin, ItemView, WorkspaceLeaf, ViewStateResult, TFile, TAbstractFile, arrayBufferToBase64 } from 'obsidian';
import EnhancedPublisherPlugin from './main';
import { CONSTANTS } from './constants';
import { log } from 'console';
import { cleanObsidianUIElements } from './utils/html-cleaner';
import { applyWechatStyle } from './utils/wechat-styler';
import { WechatThemeStyle, WechatThemeColor, THEME_STYLE_NAMES, THEME_COLOR_NAMES } from './types/wechat-theme';

// HTML预览视图的类型标识符
export const HTML_PREVIEW_VIEW_TYPE = 'enhanced-publisher-html-preview';

// 在文件顶部添加接口定义
interface HtmlPreviewCustomProperties {
    documentTitle: string;
    originalMarkdownPath: string | null;
    hasShownDeletionNotice?: boolean;
    registerActiveDocumentListener: (path: string) => void;
    registerFileChangeListener: () => void;
}

// HTML预览视图类
export class HtmlPreviewView extends ItemView implements HtmlPreviewCustomProperties {
    public htmlContent: string;
    private plugin: EnhancedPublisherPlugin;
    public documentTitle: string;
    public originalMarkdownPath: string | null = null; // 存储原始Markdown文件路径
    private documentListener: { event: string; eventRef: any } | null = null;
    public hasShownDeletionNotice: boolean = false;

    constructor(leaf: WorkspaceLeaf, plugin: EnhancedPublisherPlugin, htmlContent: string, documentTitle: string = 'HTML预览', originalMarkdownPath: string | null = null) {
        super(leaf);
        this.plugin = plugin;
        this.htmlContent = htmlContent;
        this.documentTitle = documentTitle;
        this.originalMarkdownPath = originalMarkdownPath;

        // 注册文档变化监听器
        if (originalMarkdownPath) {
            this.registerActiveDocumentListener(originalMarkdownPath);
            this.registerFileChangeListener();
        }
    }

    // 注册文档内容变化的监听
    registerActiveDocumentListener(filePath: string) {
        // 先移除旧的监听器
        this.removeDocumentListener();

        // 添加新的监听器
        this.documentListener = {
            event: 'editor-change',
            eventRef: this.plugin.app.workspace.on('editor-change', async (editor, viewInfo) => {
                // 确保是MarkdownView类型
                const markdownView = viewInfo instanceof MarkdownView ? viewInfo : null;
                if (markdownView && markdownView.file && markdownView.file.path === filePath) {
                    // 文档内容改变，刷新预览
                    await this.refreshPreview(markdownView);
                }
            })
        };

        // 注册事件以便插件卸载时能清理
        this.plugin.registerEvent(this.documentListener.eventRef);
    }

    // 完全重写的文件变化监听方法
    registerFileChangeListener() {
        // 注册对文件重命名的直接监听
        this.plugin.registerEvent(
            this.plugin.app.vault.on('rename', async (file, oldPath) => {
                if (this.originalMarkdownPath === oldPath) {
                    // 更新路径
                    this.originalMarkdownPath = file.path;

                    // 重新注册事件监听
                    this.registerActiveDocumentListener(file.path);

                    // 刷新内容
                    if (file instanceof TFile && file.extension === 'md') {
                        await this.refreshContentAfterRename(file);
                    }
                }
            })
        );

        // 注册对文件删除的直接监听
        this.plugin.registerEvent(
            this.plugin.app.vault.on('delete', (file) => {
                if (this.originalMarkdownPath === file.path) {
                    this.handleFileDeletion();
                }
            })
        );
    }

    // 处理文件删除的方法
    handleFileDeletion() {
        // 移除文档监听器
        this.removeDocumentListener();

        // 移除所有现有的警告
        const existingWarnings = this.contentEl.querySelectorAll('.html-preview-warning');
        existingWarnings.forEach(el => el.remove());

        // 添加警告 - 创建带有样式类的警告元素
        const warning = this.contentEl.createEl('div', { cls: 'html-preview-warning' });
        warning.textContent = '⚠️ 警告：原始文档已被删除或重命名，该预览内容将不会再更新';

        // 确保警告插入到DOM的最前面
        this.contentEl.prepend(warning);
    }

    // 移除文档监听器
    removeDocumentListener() {
        if (this.documentListener) {
            this.plugin.app.workspace.offref(this.documentListener.eventRef);
            this.documentListener = null;
        }
    }

    // 刷新预览内容
    async refreshPreview(markdownView?: MarkdownView) {
        try {
            let content: string;

            // 如果提供了 markdownView，从中获取内容
            if (markdownView) {
                content = markdownView.getViewData();
            }
            // 否则，从原始文件路径读取
            else if (this.originalMarkdownPath) {
                const file = this.plugin.app.vault.getAbstractFileByPath(this.originalMarkdownPath);
                if (file instanceof TFile && file.extension === 'md') {
                    content = await this.plugin.app.vault.read(file);
                } else {
                    console.error('无法读取原始文件');
                    return;
                }
            } else {
                console.error('无法获取 Markdown 内容');
                return;
            }

            // 转换为HTML
            const htmlContent = await markdownToHtml.call(this.plugin, content, this.originalMarkdownPath || '');

            // 更新视图
            this.htmlContent = htmlContent;

            // 重新渲染
            await this.onOpen();

            // 提供轻微的视觉反馈（仅在从 markdownView 刷新时）
            if (markdownView) {
                const statusBarItem = this.leaf.view.containerEl.querySelector('.html-preview-title') as HTMLElement;
                if (statusBarItem) {
                    const originalBackground = statusBarItem.className;
                    statusBarItem.classList.add('visual-feedback-success');

                    // 500毫秒后恢复原样
                    setTimeout(() => {
                        if (statusBarItem) {
                            statusBarItem.classList.remove('visual-feedback-success');
                        }
                    }, 500);
                }
            }
        } catch (error) {
            console.error('刷新HTML预览失败:', error);
            // 失败时不显示通知，避免频繁打扰
        }
    }

    getViewType(): string {
        return HTML_PREVIEW_VIEW_TYPE;
    }

    getDisplayText(): string {
        return this.documentTitle;
    }

    // 渲染视图内容
    async onOpen() {
        // 完全清空容器，不保留任何元素
        this.contentEl.empty();

        // 创建顶部工具栏
        const toolbar = this.contentEl.createDiv({ cls: 'html-preview-toolbar' });

        // 左侧区域：标题
        const titleArea = toolbar.createDiv({ cls: 'html-preview-title-area' });

        // 添加标题
        const title = titleArea.createEl('span', { cls: 'html-preview-title' });
        title.textContent = this.documentTitle;

        // 右侧区域：按钮和主题选择器
        const buttonArea = toolbar.createDiv({ cls: 'html-preview-button-area' });

        // 添加主题样式选择器
        const themeStyleContainer = buttonArea.createDiv({ cls: 'html-preview-theme-control' });
        const themeStyleLabel = themeStyleContainer.createEl('span', { cls: 'theme-control-label' });
        themeStyleLabel.textContent = '样式：';

        const themeStyleSelect = themeStyleContainer.createEl('select', { cls: 'theme-control-select' });

        Object.values(WechatThemeStyle).forEach((style: string) => {
            const option = themeStyleSelect.createEl('option');
            option.value = style;
            option.textContent = THEME_STYLE_NAMES[style as keyof typeof THEME_STYLE_NAMES];
            if (style === this.plugin.settings.wechatThemeStyle) {
                option.selected = true;
            }
        });

        themeStyleSelect.addEventListener('change', async () => {
            this.plugin.settings.wechatThemeStyle = themeStyleSelect.value as any;
            await this.plugin.saveSettings();
            await this.refreshPreview();
        });


        // 添加复制按钮
        const copyButton = buttonArea.createEl('button', { cls: 'html-preview-copy-button' });
        copyButton.textContent = '复制到内容平台';

        copyButton.addEventListener('click', async () => {
            try {
                // 创建一个临时容器来存放HTML内容
                const container = document.createElement('div');
                container.className = 'offscreen-container';

                // 使用DOMParser安全地解析HTML
                const parser = new DOMParser();
                const parsedDoc = parser.parseFromString(this.htmlContent, 'text/html');

                // 使用安全的DOM API复制内容
                const fragment = document.createDocumentFragment();
                Array.from(parsedDoc.body.childNodes).forEach(node => {
                    fragment.appendChild(document.importNode(node, true));
                });
                container.appendChild(fragment);

                document.body.appendChild(container);

                // 处理所有图片
                const images = container.querySelectorAll('img');
                for (const img of Array.from(images)) {
                    const src = img.getAttribute('src');
                    if (src && (src.startsWith('app://') || src.startsWith('data:') === false)) {
                        try {
                            let fileName = src.split('/').pop();
                            if (!fileName) continue;

                            // 如果文件名包含查询参数，去除它们
                            if (fileName.includes('?')) {
                                fileName = fileName.split('?')[0];
                            }

                            // 获取当前文档的TFile对象
                            const currentFile = this.originalMarkdownPath ?
                                this.plugin.app.vault.getAbstractFileByPath(this.originalMarkdownPath) : null;

                            if (!(currentFile instanceof TFile)) {
                                console.error('无法获取当前文档');
                                continue;
                            }

                            // 使用Obsidian API查找文件
                            const linkedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(fileName, currentFile.path);
                            if (!linkedFile || !(linkedFile instanceof TFile)) {
                                console.error(`无法找到图片文件: ${fileName}`);
                                continue;
                            }

                            // 读取图片数据
                            const arrayBuffer = await this.plugin.app.vault.readBinary(linkedFile);
                            const base64String = arrayBufferToBase64(arrayBuffer);
                            const mimeType = getMimeType(linkedFile.extension);

                            // 更新图片src为base64
                            img.src = `data:${mimeType};base64,${base64String}`;
                        } catch (imgError) {
                            console.error('处理图片失败:', imgError);
                            // 继续处理其他图片
                        }
                    }
                }

                // 创建富文本和HTML格式的数据
                const serializer = new XMLSerializer();
                const htmlString = serializer.serializeToString(container);
                const richTextBlob = new Blob([htmlString], { type: 'text/html' });
                const plainTextBlob = new Blob([container.textContent || ''], { type: 'text/plain' });

                // 使用新的Clipboard API
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'text/html': richTextBlob,
                        'text/plain': plainTextBlob,
                    })
                ]);

                // 清理临时容器
                document.body.removeChild(container);

                new Notice('内容已复制到剪贴板（包含图片），你可以粘贴到内容发布平台了');
            } catch (err) {
                console.error('复制失败:', err);
                new Notice('复制失败: ' + (err instanceof Error ? err.message : String(err)));

                // 如果新API失败，尝试使用传统方法
                try {
                    await navigator.clipboard.writeText(this.htmlContent);
                    new Notice('已使用备用方式复制内容（不含图片）');
                } catch (fallbackErr) {
                    new Notice('复制完全失败，请重试');
                }
            }
        });

        // 添加发布按钮
        const publishButton = buttonArea.createEl('button', { cls: 'html-preview-publish-button' });
        publishButton.textContent = '发布';

        publishButton.addEventListener('click', async () => {
            // 使用存储的原始文档路径，而不是当前活跃视图
            if (this.originalMarkdownPath) {
                try {
                    // 尝试打开原始文档
                    await this.plugin.app.workspace.openLinkText(this.originalMarkdownPath, '', false);
                    const markdownView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);

                    if (markdownView) {
                        // 确认找到的确实是我们要的文档
                        if (markdownView.file?.path === this.originalMarkdownPath) {
                            // 调用发布模态框
                            if (typeof this.plugin.showPublishModal === 'function') {
                                this.plugin.showPublishModal.call(this.plugin, markdownView);
                            } else {
                                new Notice('发布功能不可用');
                                console.error('无法找到showPublishModal函数');
                            }
                        } else {
                            new Notice(`无法打开原始文档: ${this.documentTitle}`);
                        }
                    } else {
                        new Notice(`无法找到原始文档: ${this.documentTitle}`);
                    }
                } catch (error) {
                    console.error('打开原始文档失败:', error);
                    new Notice(`打开原始文档失败: ${error instanceof Error ? error.message : '未知错误'}`);
                }
            } else {
                new Notice('无法确定要发布的原始文档');
            }
        });

        // 创建内容容器
        const contentContainer = this.contentEl.createDiv({ cls: 'html-preview-content' });

        // 创建iframe
        const iframe = contentContainer.createEl('iframe', { cls: 'html-preview-iframe' });

        // 设置iframe内容
        const frameDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (frameDoc) {
            const styles = `
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        padding: 20px;
                        margin: 0;
                        line-height: 1.6;
                    }
                    img {
                        max-width: 100%;
                    }
                    pre {
                        background-color: #f5f5f5;
                        padding: 10px;
                        overflow: auto;
                        border-radius: 3px;
                    }
                    code {
                        font-family: Consolas, Monaco, 'Andale Mono', monospace;
                    }
                `;

            // 提取 MathJax CSS 规则
            let mathjaxCss = '';
            try {
                // 遍历所有样式表查找 MathJax 相关的 CSS
                for (const sheet of Array.from(document.styleSheets)) {
                    try {
                        const rules = sheet.cssRules || sheet.rules;
                        if (rules) {
                            for (const rule of Array.from(rules)) {
                                const cssRule = rule as CSSStyleRule;
                                if (cssRule.selectorText &&
                                    (cssRule.selectorText.includes('mjx-') ||
                                        cssRule.selectorText.includes('.MathJax') ||
                                        cssRule.selectorText.includes('.math'))) {
                                    mathjaxCss += cssRule.cssText + '\n';
                                }
                            }
                        }
                    } catch (e) {
                        // 跳过跨域样式表
                    }
                }
                console.log('Extracted MathJax CSS length:', mathjaxCss.length);
            } catch (err) {
                console.error('Failed to extract MathJax CSS:', err);
            }

            // 直接构建完整的 HTML 字符串并通过 write 写入
            // 这样可以避免多次 DOM 解析导致的 SVG 丢失问题
            const fullHtml = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>${styles}</style>
                        <style id="mathjax-extracted-css">${mathjaxCss}</style>
                    </head>
                    <body class="html-preview-iframe-content">
                        ${this.htmlContent}
                    </body>
                    </html>
                `;

            frameDoc.open();
            frameDoc.write(fullHtml);
            frameDoc.close();
        }
    }


    // 关闭视图时清理资源
    async onClose() {
        // 移除文档监听器
        this.removeDocumentListener();

        // 清空内容
        this.contentEl.empty();
    }

    // 当视图被卸载时清理资源
    onunload() {
        // 确保所有事件监听器被移除
        this.removeDocumentListener();
    }

    // 文件重命名后刷新内容的专用方法
    async refreshContentAfterRename(file: TAbstractFile) {
        try {
            // 确认文件是TFile类型（而不是TFolder）
            if (file instanceof TFile && file.extension === 'md') {
                // 更新文档标题
                this.documentTitle = file.basename || '未命名文档';

                // 尝试获取文件内容
                const fileContent = await this.plugin.app.vault.read(file);

                // 转换为HTML
                const htmlContent = await markdownToHtml.call(this.plugin, fileContent, file.path);

                // 更新视图内容
                this.htmlContent = htmlContent;

                // 强制重新渲染视图
                await this.onOpen();

                // 显示提示
                new Notice(`已更新HTML预览: ${this.documentTitle}`);

                // 更新文档标题显示
                const titleEl = this.contentEl.querySelector('.html-preview-title') as HTMLElement;
                if (titleEl) {
                    titleEl.textContent = this.documentTitle;
                }
            }
        } catch (error) {
            console.error('刷新预览失败:', error);
            new Notice(`更新HTML预览失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    // 主动检查并更新内容 - 在定时器中调用
    async checkAndRefreshContent() {
        if (!this.originalMarkdownPath) return;

        try {
            // 检查文件是否存在
            const exists = await this.plugin.app.vault.adapter.exists(this.originalMarkdownPath);

            if (exists) {
                // 文件存在，尝试读取内容并更新
                // 获取文件
                const file = this.plugin.app.vault.getAbstractFileByPath(this.originalMarkdownPath);

                if (file instanceof TFile && file.extension === 'md') {
                    // 获取文件内容
                    const fileContent = await this.plugin.app.vault.read(file);

                    // 转换为HTML
                    const htmlContent = await markdownToHtml.call(this.plugin, fileContent, file.path);

                    // 检查内容是否有变化
                    if (this.htmlContent !== htmlContent) {
                        // 更新视图内容
                        this.htmlContent = htmlContent;

                        // 更新文档标题
                        this.documentTitle = file.basename || '未命名文档';

                        // 强制重新渲染视图
                        await this.onOpen();

                        // 更新标题显示
                        const titleEl = this.contentEl.querySelector('.html-preview-title') as HTMLElement;
                        if (titleEl) {
                            titleEl.textContent = this.documentTitle;
                        }
                    }
                }
            } else {
                // 文件不存在，显示警告
                this.handleFileDeletion();
            }
        } catch (error) {
            console.error('更新内容时出错:', error);
        }
    }
}

// 显示HTML预览
export async function showHtmlPreview(this: EnhancedPublisherPlugin, markdownView: MarkdownView) {
    try {
        // 获取Markdown内容并转换为HTML
        const content = markdownView.getViewData();
        // 获取文档标题和路径
        const documentTitle = markdownView.file?.basename || '未命名文档';
        const originalMarkdownPath = markdownView.file?.path || null;

        const htmlContent = await markdownToHtml.call(this, content, originalMarkdownPath || '');

        // 创建或获取HTML预览页签
        let leaf: WorkspaceLeaf | null;
        const existingLeaves = this.app.workspace.getLeavesOfType(HTML_PREVIEW_VIEW_TYPE);

        if (existingLeaves.length > 0) {
            // 重用现有页签
            leaf = existingLeaves[0];
        } else {
            // 创建新页签（确保创建在右侧）
            leaf = this.app.workspace.getLeaf('split', 'vertical');
            await leaf.setViewState({
                type: HTML_PREVIEW_VIEW_TYPE,
                active: true
            });
        }

        // 确保leaf不为null
        if (!leaf) {
            new Notice('无法创建HTML预览页签');
            return;
        }

        // 激活页签并更新内容
        this.app.workspace.revealLeaf(leaf);

        if (leaf.view instanceof HtmlPreviewView) {
            // 更新视图内容和元数据
            leaf.view.htmlContent = htmlContent;

            // 设置文档标题
            const htmlView = leaf.view;
            htmlView.documentTitle = documentTitle;

            // 获取旧路径并更新原始文档路径
            const oldPath = htmlView.originalMarkdownPath;
            htmlView.originalMarkdownPath = originalMarkdownPath;

            // 重置删除通知状态
            htmlView.hasShownDeletionNotice = false;

            // 如果文档路径改变，重新注册监听器
            if (oldPath !== originalMarkdownPath && originalMarkdownPath) {
                htmlView.registerActiveDocumentListener(originalMarkdownPath);
                htmlView.registerFileChangeListener();
            }

            // 重新渲染视图前移除所有警告
            const warnings = leaf.view.contentEl.querySelectorAll('.html-preview-warning');
            warnings.forEach(warning => warning.remove());

            await leaf.view.onOpen();
        }

    } catch (error) {
        console.error('HTML预览生成失败:', error);
        new Notice(`HTML预览生成失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// 智能等待异步渲染完成的辅助函数
async function waitForAsyncRender(el: HTMLElement): Promise<void> {
    const maxWaitTime = 2000;
    const interval = 100;
    let elapsed = 0;

    // 1. 检查是否需要等待 Mermaid
    const needsMermaid = el.querySelector('.mermaid') !== null;

    // 2. 检查是否需要等待 MathJax
    const needsMath = el.querySelector('.math, .math-inline, .math-block') !== null;

    if (!needsMermaid && !needsMath) {
        return; // 不需要等待！
    }

    return new Promise(resolve => {
        const check = () => {
            elapsed += interval;
            let allReady = true;

            if (needsMermaid) {
                // 检查所有 mermaid 块是否已包含 SVG
                const mermaidBlocks = el.querySelectorAll('.mermaid');
                const readyBlocks = el.querySelectorAll('.mermaid svg');
                if (readyBlocks.length < mermaidBlocks.length) {
                    allReady = false;
                }
            }

            if (needsMath) {
                // MathJax 完成检测比较困难，这里使用一个策略：
                // 如果 MathJax 仍在处理，通常会有相关类名变化
                // 但为了简单起见，如果存在数学公式，至少等待 500ms 确保处理开始
                // 或者检测 mjx-container 是否出现（如果原本没有）
                const mathBlocks = el.querySelectorAll('.math, .math-inline, .math-block');
                const processedMath = el.querySelectorAll('mjx-container');

                // 如果有数学公式但还没有任何处理结果，继续等待
                // 注意：Obsidian 的 MathJax 渲染可能直接替换元素或添加子元素
                // 这里我们给予 MathJax 更多宽容度，主要依赖超时，
                // 但如果能在短时间内检测到变化则更好。
                // 简政：如果需要 MathJax，我们至少给它 300ms 启动时间，然后检查是否还有待处理的 raw 文本结构
                // 这部分比较玄学，维持 maxWaitTime 是最安全的兜底
                // 但如果 elapsed > 500 且没有明显的未处理迹象，也可以认为好了
            }

            if (allReady || elapsed >= maxWaitTime) {
                resolve();
            } else {
                setTimeout(check, interval);
            }
        };
        check();
    });
}

// 将Markdown转换为HTML
export async function markdownToHtml(this: EnhancedPublisherPlugin, markdown: string, sourcePath: string = ''): Promise<string> {
    // 预处理 Markdown，处理自定义语法
    const processedMarkdown = preprocessMarkdown(markdown);

    // 使用Obsidian内部的Markdown渲染器
    const tempDiv = document.createElement('div');

    // 关键修正：将 tempDiv 挂载到 body，确保 Mermaid/MathJax 等需要布局计算的组件能正常渲染
    // 使用 fixed 定位将其移出可视区域，但保持其渲染能力
    tempDiv.style.position = 'fixed';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '0';
    tempDiv.style.width = '1000px'; // 给一个合理的宽度
    document.body.appendChild(tempDiv);

    try {
        await MarkdownRenderer.render(
            this.app,
            processedMarkdown,
            tempDiv,
            sourcePath,
            this
        );

        // 等待 Obsidian 完成异步渲染（Mermaid、数学公式等）
        await waitForAsyncRender(tempDiv);

        // 调试日志：检查渲染后的 DOM 中是否有特殊元素
        const svgCount = tempDiv.querySelectorAll('svg').length;
        const mermaidCount = tempDiv.querySelectorAll('.mermaid').length;
        const mathCount = tempDiv.querySelectorAll('.math, .math-inline, .math-block, mjx-container').length;
        const rubyCount = tempDiv.querySelectorAll('ruby').length;
        const plantumlCount = tempDiv.querySelectorAll('.plantuml').length;
        const imgCount = tempDiv.querySelectorAll('img').length;

        console.log(`Markdown渲染完成状态检查:`);
        console.log(`- SVG数量: ${svgCount}`);
        console.log(`- Mermaid容器数量: ${mermaidCount}`);
        console.log(`- MathJax/数学公式数量: ${mathCount}`);
        console.log(`- Ruby注音数量: ${rubyCount}`);
        console.log(`- PlantUML数量: ${plantumlCount}`);
        console.log(`- 图片数量: ${imgCount}`);

        // 调试日志：检查代码块类名，看看 PlantUML 是否只是作为普通代码块渲染
        const preElements = tempDiv.querySelectorAll('pre');
        if (preElements.length > 0) {
            console.log('检测到以下代码块(pre)类名:');
            preElements.forEach((pre, index) => {
                console.log(`- Pre #${index}: class="${pre.className}"`);
                // 检查内部 code
                const code = pre.querySelector('code');
                if (code) {
                    console.log(`  - Code: class="${code.className}"`);
                }
            });
        }

    } finally {
        // 无论成功失败，最后都要清理
        // 注意：我们稍后再移除，或者这就移除？
        // processImages 和 cleanObsidianUIElements 还需要操作这个 DOM
        // 为了安全起见，我们在函数最后移除它，或者在这里移除但不影响后续的序列化（如果是 clone 的话）
        // 由于我们后续还要操作 dom，先不移除，等操作完
    }





    // 7. 处理图片路径（包括标准 img 和背景图）
    // 注意：processImages 函数现在定义在 try 块外部或作为独立辅助函数更好，
    // 但为了保持上下文访问 (this)，我们在这里直接执行逻辑
    const images = tempDiv.querySelectorAll('img');
    for (const img of Array.from(images)) {
        await processImageSrc(img, img.getAttribute('src') || '', this);
    }

    // 处理背景图片
    const elementsWithBg = tempDiv.querySelectorAll('[style*="background-image"]');
    for (const el of Array.from(elementsWithBg)) {
        const style = (el as HTMLElement).style.backgroundImage;
        const match = style.match(/url\(['"]?([^'"]+)['"]?\)/);
        if (match) {
            // 注意：processImageSrc 期望第一个参数是 HTMLImageElement，但在处理背景图时我们传入的是 HTMLElement
            // 这里我们需要类型断言，并且 processImageSrc 内部只使用 setAttribute/classList 等通用方法，应该是安全的
            // 或者我们应该修改 processImageSrc 的签名接受 HTMLElement
            await processImageSrc(el as HTMLElement, match[1], this);
        }
    }

    // 8. 处理Obsidian内部嵌入的span标签 (internal-embed)
    const internalEmbeds = tempDiv.querySelectorAll('span.internal-embed');
    for (const span of Array.from(internalEmbeds)) {
        const src = span.getAttribute('src') || '';
        const alt = span.getAttribute('alt');

        if (src && isImageFile(src)) {
            // 创建img元素替换span
            const img = document.createElement('img');
            if (alt) img.setAttribute('alt', alt);
            img.classList.add('html-preview-image');

            // 处理img的src
            await processImageSrc(img, src, this);

            // 替换span
            if (span.parentNode) {
                span.parentNode.replaceChild(img, span);
            }
        }
    }

    // 注意：MathJax 样式将在 cleanup 后注入，防止被移除

    // 9. 在序列化之前直接在 DOM 上清理 Obsidian UI 元素
    cleanObsidianUIElements(tempDiv);

    // 10. 在 cleanup 之后注入 MathJax 样式（确保不被移除）
    const hasMath = tempDiv.querySelector('.math, .math-inline, .math-block, mjx-container');
    if (hasMath) {
        console.log('MathJax: Detected math elements after cleanup, injecting styles...');

        // 调试：检查实际的 MathJax 元素结构
        const mathElements = tempDiv.querySelectorAll('.math, .math-inline, .math-block, mjx-container');
        console.log(`MathJax: Found ${mathElements.length} math elements`);
        mathElements.forEach((el, idx) => {
            if (idx < 3) { // 只显示前3个
                console.log(`  Element ${idx}:`, {
                    tagName: el.tagName,
                    className: el.className,
                    classList: Array.from(el.classList),
                    innerHTML: el.innerHTML.substring(0, 50),
                    inlineStyle: (el as HTMLElement).style.cssText
                });
            }

            // 直接应用内联样式强制可见（比 CSS 优先级更高）
            const htmlEl = el as HTMLElement;
            htmlEl.style.visibility = 'visible';
            htmlEl.style.opacity = '1';
            htmlEl.style.color = '#000';
            htmlEl.style.fontSize = '16px';

            if (htmlEl.classList.contains('math-block')) {
                htmlEl.style.display = 'block';
            } else if (htmlEl.tagName.toLowerCase() === 'mjx-container') {
                htmlEl.style.display = 'inline-block';
            } else {
                htmlEl.style.display = 'inline';
            }

            // 对所有子元素也应用样式
            const children = htmlEl.querySelectorAll('*');
            children.forEach(child => {
                const childEl = child as HTMLElement;
                childEl.style.visibility = 'visible';
                childEl.style.opacity = '1';
                childEl.style.color = '#000';
            });

            if (idx < 3) {
                console.log(`  Applied inline styles to element ${idx}`);
            }
        });

        const style = document.createElement('style');
        style.setAttribute('data-mathjax-styles', 'true'); // 标记以便识别
        style.textContent = `
            /* 强制显示 MathJax 元素 */
            .math, .math-inline, .math-block { 
                font-family: "Latin Modern Math", "STIX Two Math", serif !important; 
                font-size: 16px !important;
                color: #000 !important;
                visibility: visible !important;
                opacity: 1 !important;
                display: inline !important;
                background: transparent !important;
            }
            
            /* 覆盖 is-loaded 可能的隐藏样式 */
            .math.is-loaded, .math-inline.is-loaded, .math-block.is-loaded {
                visibility: visible !important;
                opacity: 1 !important;
                display: inline !important;
            }
            
            .math-block.is-loaded {
                display: block !important;
            }
            
            /* MathJax 容器样式 (注意大写 M) */
            mjx-container, mjx-container.MathJax {
                display: inline-block !important;
                margin: 0 2px !important;
                color: #000 !important;
                visibility: visible !important;
                opacity: 1 !important;
                font-size: 16px !important;
            }
            
            mjx-container[display="true"] {
                display: block !important;
                text-align: center !important;
                margin: 1em 0 !important;
            }
            
            /* 强制所有 MathJax 子元素可见 - 使用通配符 */
            .math *, .math-inline *, .math-block *, mjx-container * {
                color: #000 !important;
                visibility: visible !important;
                opacity: 1 !important;
                font-size: inherit !important;
            }
            
            /* 确保内部元素也可见 */
            mjx-math, mjx-mi, mjx-mn, mjx-mo, mjx-mrow, mjx-mfrac, mjx-msup, mjx-msub {
                color: #000 !important;
                visibility: visible !important;
                font-size: inherit !important;
            }
        `;
        tempDiv.prepend(style);
        console.log('MathJax: Style tag injected at position 0 of tempDiv');
    } else {
        console.log('MathJax: No math elements detected after cleanup.');
    }

    // 关键修正：在序列化之前，移除为了渲染而添加的 fixed 定位样式
    // 否则这会导致预览内容也被定位到屏幕外 (-9999px)，看起来像空白页
    tempDiv.removeAttribute('style');

    // 使用XMLSerializer安全获取HTML内容
    // 注意：如果我们只想要内部内容，可以遍历子节点序列化，或者直接序列化 tempDiv 但它现在已经干净了
    const serializer = new XMLSerializer();
    // 我们可以只获取 innerHTML 对应的 XML 序列化结果吗？
    // 最简单的方法是将 tempDiv 的内容移到一个新的干净的 div 中，或者直接只序列化子节点拼接
    // 这里我们直接用 tempDiv，因为我们已经去掉了 style，外层多一个 div 通常没问题，或者我们可以只取 innerHTML
    // 为了最稳妥（避免外层 div干扰），我们只取 innerHTML
    // 但是 XMLSerializer 没法直接对 children 集合操作
    // 所以由于我们刚才去掉了 style，直接序列化 tempDiv 是可以的，只是多了一层 div
    // 为了避免样式干扰，我们把这些子元素移动到一个新的 DocumentFragment 或者干净的 div 中
    const cleanContainer = document.createElement('div');
    while (tempDiv.firstChild) {
        cleanContainer.appendChild(tempDiv.firstChild);
    }

    const htmlContent = serializer.serializeToString(cleanContainer);

    // 移除 XHTML 命名空间，因为它会干扰 document.write() 中的 CSS 解析
    const cleanedHtml = htmlContent.replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, '');

    // 调试：检查最终 HTML 是否包含 MathJax 样式
    if (cleanedHtml.includes('data-mathjax-styles')) {
        console.log('✓ Final HTML contains MathJax styles');
    } else {
        console.warn('✗ Final HTML does NOT contain MathJax styles!');
    }
    console.log('Final HTML preview (first 500 chars):', cleanedHtml.substring(0, 500));

    // 清理 DOM (tempDiv 此时已经空了，且已经从 body 移除)
    if (tempDiv.parentNode) {
        document.body.removeChild(tempDiv);
    }

    // 如果启用了微信样式，应用微信样式
    if (this.settings.enableWechatStyle) {
        const themeConfig = {
            style: this.settings.wechatThemeStyle,
            color: this.settings.wechatThemeColor
        };
        return applyWechatStyle(cleanedHtml, this.app, themeConfig);
    }

    return cleanedHtml;
}

// 判断文件是否为图片
function isImageFile(filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'].includes(ext);
}

// 处理图片src，转换为可访问的本地资源URL
// 处理图片src，转换为可访问的本地资源URL
async function processImageSrc(img: HTMLElement, src: string, plugin: EnhancedPublisherPlugin): Promise<void> {
    if (!src || src.startsWith('data:') || src.startsWith('http')) return;

    try {
        // 获取当前活跃文件的路径
        const activeFile = plugin.app.workspace.getActiveFile();
        if (!activeFile) return;

        // 从 src 中提取文件名
        let fileName = src.split('/').pop();
        if (!fileName) return;

        // 如果文件名包含查询参数，去除它们
        if (fileName.includes('?')) {
            fileName = fileName.split('?')[0];
        }

        // 使用 Obsidian API 查找文件
        const linkedFile = plugin.app.metadataCache.getFirstLinkpathDest(fileName, activeFile.path);
        if (!linkedFile || !(linkedFile instanceof TFile)) {
            console.error(`找不到图片: ${fileName}`);
            return;
        }

        // 使用 Obsidian 的 API 获取资源 URL
        const resourceUrl = await plugin.app.vault.adapter.getResourcePath(linkedFile.path);
        img.setAttribute('src', resourceUrl);

        // 设置图片样式
        img.classList.add('html-preview-image');

    } catch (error) {
        console.error(`处理图片失败: ${src}`, error);
    }
}




// 获取文件的MIME类型
function getMimeType(extension: string): string {
    const mimeTypes: { [key: string]: string } = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'webp': 'image/webp',
        'bmp': 'image/bmp'
    };
    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
}

/**
 * 预处理 Markdown 内容
 * 处理一些 Obsidian 标准渲染器可能不支持的自定义语法
 */
/**
 * 预处理 Markdown 内容
 * 处理一些 Obsidian 标准渲染器可能不支持的自定义语法
 */
function preprocessMarkdown(markdown: string): string {
    let processed = markdown;

    // 1. 处理 Ruby 注音语法
    // 格式1: {文字|拼音} (Obsidian 社区常见) - 支持全角竖线
    processed = processed.replace(/\{ *([^\|\}｜\n]+?) *[\|｜] *([^\|\}]+?) *\}/g, (match, text, ruby) => {
        return `<ruby>${text}<rt>${ruby}</rt></ruby>`;
    });

    // 格式2: [文字]{拼音} (Markdown Furigana 插件风格)
    processed = processed.replace(/\[((?:[^\[\]]|\\\[|\\\])+?)\]\{((?:[^\{\}]|\\\{|\\\})+?)\}/g, (match, text, ruby) => {
        return `<ruby>${text}<rt>${ruby}</rt></ruby>`;
    });

    // 格式3: [文字]^(拼音) (Markdown Furigana 插件风格)
    processed = processed.replace(/\[((?:[^\[\]]|\\\[|\\\])+?)\]\^\(((?:[^\(\)]|\\\()|\\\))+?\)/g, (match, text, ruby) => {
        return `<ruby>${text}<rt>${ruby}</rt></ruby>`;
    });

    return processed;
}
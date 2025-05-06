import { App, MarkdownRenderer, MarkdownView, Notice, Modal, Plugin, ItemView, WorkspaceLeaf, ViewStateResult, TFile, TAbstractFile, arrayBufferToBase64 } from 'obsidian';
import EnhancedPublisherPlugin from './main';
import { CONSTANTS } from './constants';
import { log } from 'console';

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
        const warning = this.contentEl.createEl('div', {cls: 'html-preview-warning'});
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
    async refreshPreview(markdownView: MarkdownView) {
        try {
            // 获取最新的Markdown内容
            const content = markdownView.getViewData();
            
            // 转换为HTML
            const htmlContent = await markdownToHtml.call(this.plugin, content);
            
            // 更新视图
            this.htmlContent = htmlContent;
            
            // 重新渲染
            await this.onOpen();
            
            // 提供轻微的视觉反馈
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
        const toolbar = this.contentEl.createDiv({cls: 'html-preview-toolbar'});
        
        // 左侧区域：标题
        const titleArea = toolbar.createDiv({cls: 'html-preview-title-area'});
        
        // 添加标题
        const title = titleArea.createEl('span', {cls: 'html-preview-title'});
        title.textContent = this.documentTitle;
        
        // 右侧区域：按钮
        const buttonArea = toolbar.createDiv({cls: 'html-preview-button-area'});
        
        // 添加复制按钮
        const copyButton = buttonArea.createEl('button', {cls: 'html-preview-copy-button'});
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
        const publishButton = buttonArea.createEl('button', {cls: 'html-preview-publish-button'});
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
        const contentContainer = this.contentEl.createDiv({cls: 'html-preview-content'});
        
        // 创建iframe
        const iframe = contentContainer.createEl('iframe', {cls: 'html-preview-iframe'});
        
        // 设置iframe内容
        const frameDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (frameDoc) {
            // 先设置 onload 事件
            iframe.onload = async () => {
                if (iframe.contentDocument) {
                    const doc = iframe.contentDocument;
                    
                    // 添加样式
                    const style = doc.createElement('style');
                    style.textContent = `
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
                    
                    doc.head.appendChild(style);
                    doc.body.classList.add('html-preview-iframe-content');
                    
                    // 使用DOMParser安全地解析HTML
                    const parser = new DOMParser();
                    const parsedContent = parser.parseFromString(this.htmlContent, 'text/html');
                    
                    // 使用安全的DOM API复制内容
                    Array.from(parsedContent.body.childNodes).forEach(node => {
                        doc.body.appendChild(doc.importNode(node, true));
                    });
                }
            };

            // 然后设置初始内容
            frameDoc.open();
            frameDoc.write('<!DOCTYPE html><html><head></head><body></body></html>');
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
                const htmlContent = await markdownToHtml.call(this.plugin, fileContent);
                
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
                    const htmlContent = await markdownToHtml.call(this.plugin, fileContent);
                    
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
        const htmlContent = await markdownToHtml.call(this, content);
        
        // 获取文档标题和路径
        const documentTitle = markdownView.file?.basename || '未命名文档';
        const originalMarkdownPath = markdownView.file?.path || null;
        
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

// 将Markdown转换为HTML
export async function markdownToHtml(this: EnhancedPublisherPlugin, markdown: string): Promise<string> {
    const processedMarkdown = markdown
    
    // 使用Obsidian内部的Markdown渲染器
    const tempDiv = document.createElement('div');
    await MarkdownRenderer.render(
        this.app,
        processedMarkdown,
        tempDiv,
        '',
        this
    );
    
    // 处理图片路径
    const processImages = async () => {
        // 处理标准img标签
        const images = tempDiv.querySelectorAll('img');
        for (const img of Array.from(images)) {
            await processImageSrc(img, img.getAttribute('src') || '', this);
        }
        
        // 处理Obsidian内部嵌入的span标签
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
    };
    
    await processImages();
    
    // 使用XMLSerializer安全获取HTML内容，而不是使用innerHTML
    const serializer = new XMLSerializer();
    return serializer.serializeToString(tempDiv);
}

// 判断文件是否为图片
function isImageFile(filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'].includes(ext);
}

// 处理图片src，转换为可访问的本地资源URL
async function processImageSrc(img: HTMLImageElement, src: string, plugin: EnhancedPublisherPlugin): Promise<void> {
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
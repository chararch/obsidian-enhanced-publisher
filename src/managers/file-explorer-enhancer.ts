import { App, TFile, TFolder, WorkspaceLeaf } from 'obsidian';
import { CONSTANTS } from '../constants';
import { AssetManager } from './asset-manager';
import { ViewManager } from './view-manager';
import { Logger } from '../utils/logger';

/**
 * 文件浏览器增强器 - 负责处理文件浏览器的显示和交互增强
 */
export class FileExplorerEnhancer {
    private app: App;
    private assetManager: AssetManager;
    private viewManager: ViewManager;
    private fileExplorerLeaf: WorkspaceLeaf | null = null;
    private expansionState: Map<string, boolean> = new Map(); // 记录展开状态：文档路径 -> 是否展开
    private styleElement: HTMLStyleElement | null = null; // 样式元素
    private isHidden: boolean = false; // 是否隐藏图片文件夹
    private mutationObserver: MutationObserver | null = null; // DOM变化观察器
    private _processingRename: string | null = null; // 处理中的重命名路径，防止重复处理
    private _mutationCount = 0;
    private _mutationPaused = false;
    private _renameHandleCount = 0;
    private _processingRenamePaths = new Set<string>();
    private _lastRenameStack = '';
    private _currentTransactionId?: string;
    private logger: Logger;

    constructor(app: App, assetManager: AssetManager, viewManager: ViewManager) {
        this.app = app;
        this.assetManager = assetManager;
        this.viewManager = viewManager;
        this.logger = Logger.getInstance(app);
    }

    /**
     * 初始化文件浏览器增强
     * @param isHidingAssetFolders 是否隐藏资源文件夹
     */
    public initialize(isHidingAssetFolders: boolean): void {
        this.findFileExplorerLeaf();
        this.registerEventListeners();
        this.setAssetFolderVisibility(isHidingAssetFolders);
    }

    /**
     * 注册事件监听器
     */
    private registerEventListeners(): void {
        // 监听文档重命名事件
        const handleDocumentRenamedEvent = (evt: CustomEvent) => {
            const { oldPath, newPath, transactionId } = evt.detail;
            
            // 处理文档重命名
            this.handleDocumentRename(oldPath, newPath, transactionId);
        };
        
        // 注册到window事件
        window.removeEventListener('enhanced-publisher:document-renamed', handleDocumentRenamedEvent);
        window.addEventListener('enhanced-publisher:document-renamed', handleDocumentRenamedEvent as EventListener);
    }

    /**
     * 处理文档重命名 - 文件浏览器UI更新
     * @param oldPath 旧文档路径
     * @param newPath 新文档路径
     * @param transactionId 事务ID，用于防止重复处理
     */
    public handleDocumentRename(oldPath: string, newPath: string, transactionId?: string): void {
        // 忽略已处理的事务
        if (transactionId && this._currentTransactionId === transactionId) {
            return;
        }
        
        this._currentTransactionId = transactionId;
        
        try {
            // 清理旧路径元素
            this.cleanupExistingElements(oldPath);
            
            // 转移展开状态
            const wasExpanded = this.expansionState.get(oldPath) || false;
            if (wasExpanded) {
                this.expansionState.set(newPath, wasExpanded);
                this.expansionState.delete(oldPath);
            }
            
            // 清理新路径可能存在的旧元素
            this.cleanupExistingElements(newPath);
            
            // 4. 重建文档指示器
            this.rebuildDocumentIndicator(newPath);
        } catch (e) {
            this.logger.error(`处理文档重命名时出错:`, e);
        }
    }

    /**
     * 重建文档指示器
     * @param docPath 文档路径
     */
    private rebuildDocumentIndicator(docPath: string): void {
        this.logger.debug(`开始重建文档指示器: ${docPath}`);
        
        // 1. 查找文档元素 - 可能需要等待DOM更新
        let attempts = 0;
        const maxAttempts = 3;
        
        const findAndEnhanceElement = () => {
            // 查找文档元素
            const docElement = document.querySelector(
                `.nav-file-title[data-path="${docPath}"], 
                 .tree-item-self[data-path="${docPath}"]`
            );
            
            // 2. 查找资源文件夹元素
            const folderPath = docPath.replace(/\.md$/, CONSTANTS.ASSETS_FOLDER_SUFFIX);
            const folderElement = document.querySelector(
                `.nav-folder-title[data-path="${folderPath}"], 
                 .tree-item-self[data-path="${folderPath}"]`
            );
            
            if (!docElement || !folderElement) {
                attempts++;
                if (attempts < maxAttempts) {
                    this.logger.debug(`未找到文档或资源文件夹元素，第${attempts}次尝试: ${docPath} ${folderPath}`);
                    // 使用requestAnimationFrame等待下一帧
                    window.requestAnimationFrame(findAndEnhanceElement);
                    return;
                } else {
                    this.logger.debug(`多次尝试后仍未找到文档或资源文件夹元素: ${docPath} ${folderPath}`);
                    return;
                }
            }
            
            // 3. 增强文档元素 - 已包含创建指示器和容器的逻辑
            this.enhanceDocumentElement(docElement, docPath, folderElement, folderPath);
        };
        
        // 开始查找并增强元素
        findAndEnhanceElement();
    }
    
    /**
     * 清理现有元素，确保重建前的干净状态
     * @param docPath 文档路径
     */
    private cleanupExistingElements(docPath: string): void {
        // 1. 移除所有与该文档相关的容器及其内容
        const containers = document.querySelectorAll(`.document-images-container[data-doc-path="${docPath}"]`);
        
        if (containers.length > 0) {
            containers.forEach((container, index) => {
                // 使用ViewManager清空容器内容
                this.viewManager.clearContainer(container as HTMLElement);
                
                // 移除容器本身
                container.remove();
            });
        }
        
        // 2. 移除文档上的指示器
        const docElements = document.querySelectorAll(
            `.nav-file-title[data-path="${docPath}"], 
             .tree-item-self[data-path="${docPath}"]`
        );
        
        if (docElements.length > 0) {
            docElements.forEach((docElement, index) => {
                // 移除指示器
                const indicators = docElement.querySelectorAll('.image-expand-indicator');
                indicators.forEach(indicator => {
                    // 移除指示器的事件监听器
                    const clone = indicator.cloneNode(true);
                    if (indicator.parentNode) {
                        indicator.parentNode.replaceChild(clone, indicator);
                    }
                    // 使用类型断言确保TypeScript知道它是HTMLElement
                    (clone as HTMLElement).remove();
                });
                
                // 移除父元素上的标记类
                const parent = docElement.parentElement;
                if (parent) {
                    parent.classList.remove('has-images');
                }
            });
        }
    }

    /**
     * 设置资源文件夹可见性
     * @param isHiding 是否隐藏
     */
    public setAssetFolderVisibility(isHiding: boolean): void {
        // 更新状态
        this.isHidden = isHiding;
        
        // 更新样式
        this.applyStyles(isHiding);
        
        if (isHiding) {
            // 激活增强
            this.setupMutationObserver();
            this.enhanceFileExplorer();
        } else {
            // 还原文件浏览器
            this.resetFileExplorer();
        }
    }

    /**
     * 寻找文件浏览器叶子
     */
    private findFileExplorerLeaf(): void {
        this.fileExplorerLeaf = null;
        
        // 查找文件浏览器叶子
        const fileExplorers = this.app.workspace.getLeavesOfType('file-explorer');
        if (fileExplorers.length > 0) {
            this.fileExplorerLeaf = fileExplorers[0];
        }
    }

    /**
     * 应用样式
     * @param isHiding 是否隐藏资源文件夹
     */
    private applyStyles(isHiding: boolean): void {
        // 移除旧样式
        if (this.styleElement) {
            this.styleElement.remove();
            this.styleElement = null;
        }

        // 添加新样式
        this.styleElement = document.createElement('style');
        this.styleElement.id = CONSTANTS.STYLE_ELEMENT_ID;

        if (isHiding) {
            // 隐藏资源文件夹的样式
            this.styleElement.textContent = `
                /* 隐藏资源文件夹 */
                .nav-folder-title[data-path$="${CONSTANTS.ASSETS_FOLDER_SUFFIX}"],
                .tree-item-self[data-path$="${CONSTANTS.ASSETS_FOLDER_SUFFIX}"],
                .nav-folder-title[data-path$="${CONSTANTS.ASSETS_FOLDER_SUFFIX}"] ~ .nav-folder-children,
                .tree-item-self[data-path$="${CONSTANTS.ASSETS_FOLDER_SUFFIX}"] ~ .tree-item-children {
                    display: none !important;
                }
            `;
        }

        // 添加到文档
        document.head.appendChild(this.styleElement);
    }

    /**
     * 设置DOM变化观察器
     */
    private setupMutationObserver(): void {
        // 断开现有观察器
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }
        
        // 创建新的观察器
        this.mutationObserver = new MutationObserver((mutations) => {
            // 如果观察器被暂停，则忽略变更
            if (this._mutationPaused) {
                return;
            }
            
            // 计数变更，用于调试
            this._mutationCount++;
            
            // 如果正在处理重命名，记录但不处理
            if (this._processingRenamePaths.size > 0) {
                return;
            }
            
            // 延迟处理变更，减少频繁更新
            requestAnimationFrame(() => {
                this.processFileExplorerChanges(mutations);
            });
        });
        
        // 获取文件浏览器元素
        const fileExplorer = this.getFileExplorerElement();
        if (fileExplorer) {
            // 开始观察变更
            this.mutationObserver.observe(fileExplorer, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'style', 'data-path']
            });
        }
    }

    /**
     * 获取文件浏览器DOM元素
     */
    private getFileExplorerElement(): HTMLElement | null {
        if (!this.fileExplorerLeaf) {
            this.findFileExplorerLeaf();
        }

        if (this.fileExplorerLeaf) {
            // 尝试获取文件浏览器的容器元素
            return this.fileExplorerLeaf.view.containerEl;
        }

        return null;
    }

    /**
     * 处理文件浏览器变化
     */
    private processFileExplorerChanges(mutations: MutationRecord[]): void {
        // 如果没有开启隐藏，则不处理
        if (!this.isHidden) return;

        // 1. 首先确保我们处理所有可能的文档
        const documentElements = document.querySelectorAll(
            `.nav-file-title[data-path$=".md"], 
             .tree-item-self[data-path$=".md"]`
        );

        // 处理文档元素
        documentElements.forEach(docElement => {
            // 跳过已处理的元素
            if (docElement.querySelector('.image-expand-indicator')) return;
            
            const docPath = docElement.getAttribute('data-path');
            if (!docPath) return;
            
            // 查找对应的资源文件夹
            const folderPath = docPath.replace(/\.md$/, CONSTANTS.ASSETS_FOLDER_SUFFIX);
            const folderElement = document.querySelector(
                `.nav-folder-title[data-path="${folderPath}"], 
                 .tree-item-self[data-path="${folderPath}"]`
            );
            
            // 如果找到对应的资源文件夹，则增强文档元素
            if (folderElement) {
                this.enhanceDocumentElement(docElement, docPath, folderElement, folderPath);
            }
        });

        // 2. 处理每个资源文件夹及其对应的文档
        const assetFolderElements = document.querySelectorAll(
            `.nav-folder-title[data-path$="${CONSTANTS.ASSETS_FOLDER_SUFFIX}"], 
             .tree-item-self[data-path$="${CONSTANTS.ASSETS_FOLDER_SUFFIX}"]`
        );

        // 处理每个资源文件夹
        assetFolderElements.forEach(folderEl => {
            const folderPath = folderEl.getAttribute('data-path');
            if (!folderPath) return;

            // 获取对应的文档路径
            const docPath = folderPath.replace(CONSTANTS.ASSETS_FOLDER_SUFFIX, '.md');
            
            // 查找文档元素
            const docElement = document.querySelector(
                `.nav-file-title[data-path="${docPath}"], 
                 .tree-item-self[data-path="${docPath}"]`
            );

            // 检查元素是否已经有指示器，如果没有则添加
            if (docElement && !docElement.querySelector('.image-expand-indicator')) {
                this.enhanceDocumentElement(docElement, docPath, folderEl, folderPath);
            }
        });
    }

    /**
     * 增强文件浏览器，添加图片折叠功能
     */
    public enhanceFileExplorer(): void {
        this.logger.debug('开始增强文件浏览器');
        
        // 检查环境条件
        if (!this.isHidden) {
            this.logger.debug('图片文件夹未隐藏，不需要增强');
            return;
        }
        
        // 尝试处理所有文件夹，支持自动重试
        const attemptProcessFolders = async (retryCount: number = 0, maxRetries: number = 5): Promise<void> => {
            // 如果达到最大重试次数，停止
            if (retryCount > maxRetries) {
                this.logger.debug(`已达到最大重试次数 ${maxRetries}，停止处理`);
                return;
            }
            
            // 确保文件浏览器叶子已找到
            if (!this.fileExplorerLeaf) {
                this.findFileExplorerLeaf();
                if (!this.fileExplorerLeaf) {
                    this.logger.debug('未找到文件浏览器叶子，等待后重试');
                    
                    // 延迟后重试
                    setTimeout(() => attemptProcessFolders(retryCount + 1, maxRetries), 100);
                    return;
                }
            }
            
            // 查找资源文件夹
            const assetFolders = await this.assetManager.detectAssetFolders();
            this.logger.debug(`发现 ${assetFolders.size} 个资源文件夹，处理中...`);
            
            // 检查文件浏览器元素是否可访问
            const fileExplorerEl = this.getFileExplorerElement();
            if (!fileExplorerEl) {
                this.logger.debug('文件浏览器元素不可访问，等待后重试');
                setTimeout(() => attemptProcessFolders(retryCount + 1, maxRetries), 100);
                return;
            }
            
            // 主要处理逻辑
            let processedCount = 0;
            let pendingDocs: [string, string][] = []; // 存储未处理的文档 [docPath, folderPath]
            
            // 处理每一个资源文件夹
            for (const [docPath, folderPath] of assetFolders.entries()) {
                // 检查文档是否已有指示器
                const existingIndicators = document.querySelectorAll(
                    `.nav-file-title[data-path="${docPath}"] .image-expand-indicator, 
                     .tree-item-self[data-path="${docPath}"] .image-expand-indicator`
                );
                
                if (existingIndicators.length > 0) {
                    // 文档已有指示器，已处理过
                    processedCount++;
                    continue;
                }
                
                // 查找文档元素
                const docElement = fileExplorerEl.querySelector(`.nav-file-title[data-path="${docPath}"]`);
                
                // 查找文件夹元素
                const folderElement = fileExplorerEl.querySelector(`.nav-folder[data-path="${folderPath}"]`) || 
                                     fileExplorerEl.querySelector(`.nav-folder-title[data-path="${folderPath}"]`);
                
                // 如果两个元素都找到了
                if (docElement && folderElement) {
                    this.logger.debug(`处理文档: ${docPath}`);
                    this.enhanceDocumentElement(docElement, docPath, folderElement, folderPath);
                    processedCount++;
                } else {
                    // 记录未处理的文档
                    pendingDocs.push([docPath, folderPath]);
                }
            }
            
            this.logger.debug(`成功处理 ${processedCount} 个文档，待处理 ${pendingDocs.length} 个`);
            
            // 如果还有未处理的文档，且未达到最大重试次数，安排下一次重试
            if (pendingDocs.length > 0 && retryCount < maxRetries) {
                // 指数退避策略 - 重试间隔随着重试次数增加而增加，但不超过1秒
                const delay = Math.min(100 * Math.pow(1.5, retryCount), 1000);
                this.logger.debug(`将在 ${delay}ms 后重试未处理的 ${pendingDocs.length} 个文档`);
                
                setTimeout(() => attemptProcessFolders(retryCount + 1, maxRetries), delay);
            }
        };
        
        // 开始处理文件夹
        attemptProcessFolders();
    }

    /**
     * 增强文档元素
     * @param docElement 文档元素
     * @param docPath 文档路径
     * @param folderElement 文件夹元素
     * @param folderPath 文件夹路径
     */
    private enhanceDocumentElement(
        docElement: Element, 
        docPath: string, 
        folderElement: Element, 
        folderPath: string
    ): void {
        // 确保使用正确的文档标题元素
        let titleElement: Element;
        
        titleElement = docElement; // 已经是标题元素
        
        // 检查标题元素是否已经处理过
        if (titleElement.querySelector('.image-expand-indicator')) {
            this.logger.debug(`文档已有指示器，跳过: ${docPath}`);
            return;
        }
        
        // 1. 标记文档元素
        const docParent = docElement.parentElement;
        if (docParent) {
            docParent.classList.add('has-images');
        } else {
            docElement.classList.add('has-images');
        }

        // 2. 添加展开指示器到标题元素
        const indicator = this.createExpandIndicator(titleElement, docPath, folderPath);
        titleElement.insertBefore(indicator, titleElement.firstChild);

        // 3. 检查现有容器，避免创建重复的容器
        const existingContainer = document.querySelector(`.document-images-container[data-doc-path="${docPath}"]`);
        if (existingContainer) {
            this.logger.debug(`文档已有图片容器，跳过创建: ${docPath}`);
            return;
        }

        // 4. 创建图片容器
        this.createImagesContainer(docPath, folderPath, docElement);
    }

    /**
     * 创建展开指示器
     * @param docElement 文档元素
     * @param docPath 文档路径
     * @param folderPath 文件夹路径
     */
    private createExpandIndicator(
        docElement: Element, 
        docPath: string, 
        folderPath: string
    ): HTMLElement {
        // 获取展开状态
        const isExpanded = this.expansionState.get(docPath) || false;
        
        // 创建指示器
        const indicator = document.createElement('div');
        indicator.classList.add('tree-item-icon', 'collapse-icon', 'image-expand-indicator');
        indicator.classList.toggle('is-collapsed', !isExpanded);
        
        // 设置图标 - 使用DOM API创建SVG，而不是innerHTML
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svg.setAttribute('width', '24');
        svg.setAttribute('height', '24');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.classList.add('svg-icon', 'right-triangle');
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M3 8L12 17L21 8');
        
        svg.appendChild(path);
        indicator.appendChild(svg);
        
        // 添加点击事件
        indicator.addEventListener('click', (evt) => {
            evt.stopPropagation();
            evt.preventDefault();
            
            // 切换展开状态 - 修复逻辑错误
            const isCurrentlyCollapsed = indicator.classList.contains('is-collapsed');
            this.toggleExpansion(docPath, isCurrentlyCollapsed, indicator);
        });
        
        // 返回指示器
        return indicator;
    }

    /**
     * 创建图片容器
     * @param docPath 文档路径
     * @param folderPath 文件夹路径
     * @param docElement 文档元素
     */
    private createImagesContainer(
        docPath: string, 
        folderPath: string, 
        docElement: Element
    ): void {
        // 获取展开状态
        const isExpanded = this.expansionState.get(docPath) || false;
        
        // 创建父元素引用
        const parent = docElement.parentElement;
        if (!parent) return;
        
        // 使用ViewManager创建图片容器
        const container = this.viewManager.createImageContainer({
            docPath,
            folderPath,
            isExpanded
        });
        
        // 插入容器
        if (docElement.nextSibling) {
            parent.insertBefore(container, docElement.nextSibling);
        } else {
            parent.appendChild(container);
        }
        
        // 加载图片内容
        this.loadImagesIntoContainer(container, folderPath, docPath);
    }

    /**
     * 加载图片到容器中
     * @param container 容器元素
     * @param folderPath 资源文件夹路径
     * @param docPath 文档路径
     */
    private async loadImagesIntoContainer(
        container: HTMLElement, 
        folderPath: string, 
        docPath: string
    ): Promise<void> {
        // 容器有效性检查
        if (!container || !container.isConnected) {
            return;
        }
        
        try {
            // 使用视图管理器更新容器内容
            await this.viewManager.updateImagesContainer(container, folderPath, docPath);
            
            // 设置展开状态
            const isExpanded = this.expansionState.get(docPath) || false;
            container.classList.remove(isExpanded ? 'hidden' : 'visible');
            container.classList.add(isExpanded ? 'visible' : 'hidden');
            
            // 保存状态
            this.saveExpansionState();
        } catch (error) {
            this.logger.error(`加载图片到容器时出错:`, error);
        }
    }

    /**
     * 切换展开状态
     * @param docPath 文档路径
     * @param expand 是否展开
     * @param indicator 指示器元素
     */
    private toggleExpansion(
        docPath: string, 
        expand: boolean, 
        indicator?: HTMLElement
    ): void {
        // 更新状态
        this.expansionState.set(docPath, expand);
        
        // 更新指示器
        if (indicator) {
            indicator.classList.toggle('is-collapsed', !expand);
        } else {
            const indicatorEls = document.querySelectorAll(
                `.nav-file-title[data-path="${docPath}"] .image-expand-indicator, 
                 .tree-item-self[data-path="${docPath}"] .image-expand-indicator`
            );
            
            if (indicatorEls.length > 0) {
                indicatorEls.forEach(el => el.classList.toggle('is-collapsed', !expand));
            }
        }
        
        // 使用ViewManager设置容器可见性
        this.viewManager.setContainerVisibility(docPath, expand);
        
        // 保存展开状态
        this.saveExpansionState();
    }

    /**
     * 重置文件浏览器
     */
    private resetFileExplorer(): void {
        // 移除所有添加的展开指示器
        document.querySelectorAll('.image-expand-indicator').forEach(el => el.remove());
        
        // 移除所有文档图片容器
        document.querySelectorAll('.document-images-container').forEach(el => el.remove());
        
        // 移除所有has-images标记
        document.querySelectorAll('.has-images').forEach(el => {
            el.classList.remove('has-images');
        });
        
        // 确保所有资源文件夹可见
        document.querySelectorAll(
            `.nav-folder-title[data-path$="${CONSTANTS.ASSETS_FOLDER_SUFFIX}"], 
             .tree-item-self[data-path$="${CONSTANTS.ASSETS_FOLDER_SUFFIX}"]`
        ).forEach(el => {
            (el as HTMLElement).classList.remove('hidden');
            // 不需要设置display，因为我们完全依赖CSS
        });
        
        // 保存展开状态以备后用
        this.saveExpansionState();
    }

    /**
     * 保存展开状态
     */
    private saveExpansionState(): void {
        // 虽然UI已重置，但保留状态对象以备后用
    }

    /**
     * 刷新指定文档的图片容器
     * @param docPath 文档路径
     * @param forceUpdate 是否强制更新，默认为false
     */
    public refreshDocumentContainer(docPath: string, forceUpdate: boolean = false): void {
        if (!this.isHidden) return;
        
        // 使用ViewManager刷新文档视图
        this.viewManager.refreshDocumentView(docPath, forceUpdate);
    }

    /**
     * 全局展开所有文档图片
     * @param expand 是否展开
     */
    public expandAllDocumentImages(expand: boolean): void {
        // 获取所有文档图片容器
        document.querySelectorAll('.document-images-container').forEach(container => {
            const docPath = container.getAttribute('data-doc-path');
            if (docPath) {
                this.toggleExpansion(docPath, expand);
            }
        });
    }

    /**
     * 清理资源
     */
    public cleanup(): void {
        // 移除观察器
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
        }
        
        // 移除样式
        if (this.styleElement) {
            this.styleElement.remove();
            this.styleElement = null;
        }
        
        // 重置文件浏览器
        this.resetFileExplorer();
    }

    /**
     * 准备DOM变化观察器 - 公共方法用于暂停/恢复观察器
     * @param enable 是否启用观察器
     */
    public prepareMutationObserver(enable: boolean): void {
        if (enable) {
            this._mutationPaused = false;
        } else {
            this._mutationPaused = true;
        }
    }

    /**
     * 刷新文件浏览器视图
     */
    public async refreshView(): Promise<void> {
        // 清理当前增强器
        this.cleanup();
        
        // 重新初始化，传入新的设置
        this.initialize(this.isHidden);
        
        // 触发刷新所有容器
        window.dispatchEvent(new CustomEvent(CONSTANTS.EVENTS.REFRESH_CONTAINERS));
        
        // 如果开启了隐藏图片文件夹功能，只在布局就绪后执行增强
        // 避免多次调用造成重复处理
        if (this.isHidden) {
            this.logger.debug('等待布局就绪后执行文件浏览器增强');
            
            // 触发布局变化
            this.app.workspace.trigger('layout-change');
            
            // 使用布局就绪回调确保DOM已更新
            this.app.workspace.onLayoutReady(() => {
                this.logger.debug('布局就绪，执行文件浏览器增强');
                this.enhanceFileExplorer();
            });
        }
    }
}
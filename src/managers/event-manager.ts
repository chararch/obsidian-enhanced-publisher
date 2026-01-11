import { App, TFile, TFolder, TAbstractFile, Events, Notice } from 'obsidian';
import { CONSTANTS } from '../constants';
import { AssetManager } from './asset-manager';
import { DocumentManager } from './document-manager';
import { FileExplorerEnhancer } from './file-explorer-enhancer';
import { ViewManager } from './view-manager';
import EnhancedPublisherPlugin from '../main';
import { Logger } from '../utils/logger';

/**
 * 事件管理器 - 负责处理Obsidian事件和自定义事件
 * 采用事件委托模式，统一管理所有重命名相关事件
 */
export class EventManager {
    private app: App;
    private plugin: EnhancedPublisherPlugin;
    private assetManager: AssetManager;
    private documentManager: DocumentManager;
    private fileExplorerEnhancer: FileExplorerEnhancer;
    private viewManager: ViewManager;
    private events: Events;
    private logger: Logger;

    // 事务跟踪 - 解决重命名事件重复处理问题
    private _currentRenameTransactionId?: string;
    private _processedPathsInTransaction = new Set<string>();
    private _transactionTimeout: NodeJS.Timeout | null = null;
    private _isDocumentRenameInProgress = false;
    private _renameEventListener: (file: TAbstractFile, oldPath: string) => void;
    private _processedTransactions = new Set<string>(); // 全局已处理事务集合

    constructor(
        app: App,
        plugin: EnhancedPublisherPlugin,
        assetManager: AssetManager,
        documentManager: DocumentManager,
        fileExplorerEnhancer: FileExplorerEnhancer,
        viewManager: ViewManager
    ) {
        this.app = app;
        this.plugin = plugin;
        this.assetManager = assetManager;
        this.documentManager = documentManager;
        this.fileExplorerEnhancer = fileExplorerEnhancer;
        this.viewManager = viewManager;
        this.events = new Events();
        this.logger = Logger.getInstance(app);
    }

    /**
     * 生成事务ID
     */
    private _generateTransactionId(): string {
        return Date.now().toString() + Math.random().toString().slice(2, 8);
    }

    /**
     * 开始新的重命名事务
     */
    private startNewRenameTransaction(path: string): string {
        // 清理旧事务
        this.clearRenameTransaction();

        // 创建新事务
        this._currentRenameTransactionId = this._generateTransactionId();
        this._processedPathsInTransaction.clear();
        this._isDocumentRenameInProgress = true;

        // 设置事务超时（10秒后自动清理）
        this._transactionTimeout = setTimeout(() => {
            this.clearRenameTransaction();
        }, 10000);

        return this._currentRenameTransactionId;
    }

    /**
     * 清理重命名事务
     */
    private clearRenameTransaction(): void {
        if (this._transactionTimeout) {
            clearTimeout(this._transactionTimeout);
            this._transactionTimeout = null;
        }

        // 只在确实有进行中的事务时才进行清理
        if (this._currentRenameTransactionId) {
            // 标记当前事务ID为已处理，防止重复触发
            if (this._currentRenameTransactionId) {
                this._processedTransactions.add(this._currentRenameTransactionId);

                // 限制已处理事务集合大小，避免无限增长
                if (this._processedTransactions.size > 50) {
                    // 移除最早的10个事务ID
                    const toRemove = Array.from(this._processedTransactions).slice(0, 10);
                    toRemove.forEach(id => this._processedTransactions.delete(id));
                }
            }

            this._currentRenameTransactionId = undefined;
            this._processedPathsInTransaction.clear();
            this._isDocumentRenameInProgress = false;
        }
    }

    /**
     * 标记路径在当前事务中已处理
     */
    private markPathAsProcessedInTransaction(path: string): void {
        if (!this._currentRenameTransactionId) {
            return;
        }

        this._processedPathsInTransaction.add(path);
    }

    /**
     * 注册事件处理器
     */
    public registerEvents(): void {
        // 监听文件重命名事件
        this._renameEventListener = (file: TAbstractFile, oldPath: string) => {
            // 忽略相同路径的重命名
            if (file.path === oldPath) {
                return;
            }

            // 根据文件类型分发
            if (file instanceof TFile) {
                // 处理markdown文档重命名
                if (file.extension === "md") {
                    // 捕获异常，防止事件处理崩溃
                    try {
                        this.handleDocumentRenameProcess(file, oldPath);
                    } catch (e) {
                        console.error("处理文档重命名时出错:", e);
                    }
                }
                // 处理图片文件重命名
                else if (CONSTANTS.IMAGE_EXTENSIONS.includes(`.${file.extension}`)) {
                    // 如果图片在资源文件夹中，处理图片重命名
                    if (this.isInAssetFolder(file.path)) {
                        try {
                            if (file instanceof TFile) {
                                this.handleImageRename(oldPath, file);
                            }
                        } catch (e) {
                            console.error("处理图片重命名时出错:", e);
                        }
                    }
                }
            }
            // 处理资源文件夹重命名
            else if (file instanceof TFolder && this.isAssetFolder(file.path)) {
                try {
                    this.handleAssetFolderRename(file, oldPath);
                } catch (e) {
                    console.error("处理资源文件夹重命名时出错:", e);
                }
            }
        };

        // 注册到Obsidian事件系统
        this.app.vault.on("rename", this._renameEventListener);

        // 监听文件删除事件
        this.app.vault.on("delete", (file) => {
            // 如果是图片被删除，尝试刷新相关文档的视图
            if (file instanceof TFile && CONSTANTS.IMAGE_EXTENSIONS.includes(`.${file.extension}`)) {
                this.handleImageDelete(file);
            }
        });
    }

    /**
     * 处理文档重命名过程
     * @param file 新的文件对象
     * @param oldPath 旧路径
     */
    private async handleDocumentRenameProcess(file: TFile, oldPath: string): Promise<void> {
        // 检查目标路径是否已存在
        const newPath = file.path;
        // 3. 处理资源文件夹重命名 (使用 AssetManager)
        // 注意：AssetManager 已有 renameAssetFolder 方法，这里可能是旧逻辑的重复？
        // 实际上，EventManager 似乎在尝试手动处理？
        // 为了修复错误，先替换常量。但最终应该委托给 AssetManager。

        const oldAssetFolder = oldPath.replace(/\.md$/, CONSTANTS.DEFAULT_ASSETS_SUFFIX);
        const newAssetFolder = newPath.replace(/\.md$/, CONSTANTS.DEFAULT_ASSETS_SUFFIX);

        // 如果目标资源文件夹已存在，先处理冲突
        try {
            const existingTargetFolder = this.app.vault.getAbstractFileByPath(newAssetFolder);
            if (existingTargetFolder instanceof TFolder && oldPath !== newPath) {
                // 如果目标文件夹已存在，尝试移动到临时路径
                const tempPath = `${newAssetFolder}-temp-${Date.now()}`;
                await this.app.fileManager.renameFile(existingTargetFolder, tempPath);
            }
        } catch (error) {
            console.error("处理目标文件夹冲突时出错:", error);
        }

        // 生成事务ID用于跟踪整个重命名过程
        const transactionId = this.startNewRenameTransaction(oldPath);

        try {
            // 暂停文件浏览器DOM观察器，避免DOM频繁重建
            this.fileExplorerEnhancer.prepareMutationObserver(false);

            // 使用DocumentManager处理文档重命名
            await this.documentManager.handleDocumentRename(file, oldPath);

            // 处理文件浏览器中的UI更新
            this.fileExplorerEnhancer.handleDocumentRename(oldPath, file.path, transactionId);

            // 更新视图管理器
            this.viewManager.refreshDocumentView(file.path);

            // 分发自定义事件，通知其他组件文档已重命名
            const customEvent = new CustomEvent('enhanced-publisher:document-renamed', {
                detail: {
                    oldPath: oldPath,
                    newPath: file.path,
                    transactionId: transactionId
                }
            });
            window.dispatchEvent(customEvent);

        } catch (error) {
            console.error("文档重命名过程出错:", error);
        } finally {
            // 恢复DOM观察器
            this.fileExplorerEnhancer.prepareMutationObserver(true);

            // 清理事务
            this.clearRenameTransaction();
        }
    }

    /**
     * 处理资源文件夹重命名
     * @param folder 新的文件夹对象
     * @param oldPath 旧路径
     */
    private handleAssetFolderRename(folder: TFolder, oldPath: string): void {
        if (folder.path === oldPath) {
            return;
        }

        // 检查是否正在处理文档重命名事务
        if (this._isDocumentRenameInProgress) {
            // 如果处于文档重命名过程中，此事件是由文档重命名触发的
            // 标记此路径已处理，避免重复处理
            this.markPathAsProcessedInTransaction(folder.path);
            return;
        }

        // 从资源文件夹路径获取文档路径
        const oldDocPath = oldPath.replace(CONSTANTS.DEFAULT_ASSETS_SUFFIX, '.md');
        const newDocPath = folder.path.replace(CONSTANTS.DEFAULT_ASSETS_SUFFIX, '.md');

        // 检查文档是否存在
        const docFile = this.app.vault.getAbstractFileByPath(newDocPath);
        if (docFile instanceof TFile) {
            // 资源文件夹被重命名，但文档存在，可能需要更新文档中的引用
            this.assetManager.updateImageReferences(newDocPath, oldPath, folder.path);
        }
    }

    /**
     * 处理图片重命名事件
     */
    private async handleImageRename(oldPath: string, file: TFile): Promise<void> {
        // 获取旧的图片名称
        const oldImageName = oldPath.split('/').pop() || '';

        this.logger.debug(`处理图片重命名：${oldPath} -> ${file.path}`);

        // 暂停DOM观察器，避免重复处理
        this.fileExplorerEnhancer.prepareMutationObserver(false);

        try {
            // 搜索引用该图片的文档
            this.logger.debug(`搜索引用图片的文档...`);
            const referencingDocs = await this.documentManager.findReferencingDocs(oldImageName);
            this.logger.debug(`找到 ${referencingDocs.length} 个引用该图片的文档`);

            // 更新每个文档中的图片引用
            let updatedCount = 0;
            for (const docFile of referencingDocs) {
                this.logger.debug(`更新文档 ${docFile.path} 中的图片引用`);
                const updated = await this.documentManager.updateImageReference(docFile, oldPath, file.path);
                if (updated) {
                    updatedCount++;
                }
            }

            this.logger.debug(`已更新 ${updatedCount} 个文档的图片引用`);

        } finally {
            // 恢复DOM观察器
            this.fileExplorerEnhancer.prepareMutationObserver(true);
        }
    }

    /**
     * 处理图片删除事件
     */
    private handleImageDelete(file: TFile): void {
        // 使用 AssetManager 的缓存反向查找文档路径
        const docPath = this.assetManager.getDocumentPathFromImagePath(file.path);

        if (docPath) {
            this.logger.debug(`检测到图片删除: ${file.path}，刷新文档: ${docPath}`);
            this.viewManager.refreshDocumentView(docPath, true);
        }
    }

    /**
     * 判断路径是否在资源文件夹中
     * @param path 文件路径
     */
    private isInAssetFolder(path: string): boolean {
        return this.assetManager.isInAssetFolder(path);
    }

    /**
     * 判断是否为图片文件
     * @param path 文件路径
     */
    private isImageFile(path: string): boolean {
        const extension = path.split('.').pop();
        return extension ? CONSTANTS.IMAGE_EXTENSIONS.includes(`.${extension}`) : false;
    }

    /**
     * 判断是否为资源文件夹
     * @param path 文件夹路径
     */
    private isAssetFolder(path: string): boolean {
        return path.endsWith(CONSTANTS.DEFAULT_ASSETS_SUFFIX);
    }

    /**
     * 清理资源
     */
    public cleanup(): void {
        // 移除事件监听器
        if (this._renameEventListener) {
            this.app.vault.off("rename", this._renameEventListener);
        }

        // 清理事务状态
        this.clearRenameTransaction();
    }
}
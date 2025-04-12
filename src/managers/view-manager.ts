import { App, TFile, TFolder, View, Notice, Menu, Modal } from 'obsidian';
import { CONSTANTS } from '../constants';
import { AssetManager } from './asset-manager';


/**
 * 图片容器配置接口
 */
export interface ImageContainerOptions {
    docPath: string;
    folderPath: string;
    parentElement?: Element;
    isExpanded?: boolean;
    customClass?: string;
}

/**
 * 视图管理器 - 负责管理UI视图相关操作
 */
export class ViewManager {
    private app: App;
    private assetManager: AssetManager;
    private viewUpdateRegistry: Map<string, number> = new Map(); // 记录视图更新标记：路径 -> 时间戳
    private refreshContainersHandler: EventListener;
    private documentClickHandler: EventListener;

    constructor(app: App, assetManager: AssetManager) {
        this.app = app;
        this.assetManager = assetManager;

        this.refreshContainersHandler = () => {
            this.refreshAllViews();
        };

        this.documentClickHandler = (evt) => {
            // 检查点击的元素是否为文档或其子元素，而不是图片元素
            const target = evt.target as HTMLElement;
            const isImageTitle = !!target.closest('.nav-file-title[data-path]') && 
                               !!target.closest('.document-images-container');
            
            // 如果不是点击的图片，则清除所有图片选中状态
            if (!isImageTitle) {
                document.querySelectorAll('.document-images-container .is-active').forEach(el => {
                    el.classList.remove('is-active');
                });
            }
        }
    }

    /**
     * 初始化视图管理器
     */
    public initialize(): void {
        // 注册事件监听器
        this.registerEventListeners();
    }

    /**
     * 注册事件监听器
     */
    private registerEventListeners(): void {
        // 监听自定义事件 - 简化后只需要刷新容器事件
        window.addEventListener(CONSTANTS.EVENTS.REFRESH_CONTAINERS, this.refreshContainersHandler);
        // 监听文档点击事件，清除图片选中状态
        document.addEventListener('click', this.documentClickHandler, true); // 使用捕获阶段，确保在事件冒泡前执行
    }

    /**
     * 刷新文档视图
     * @param docPath 文档路径
     * @param forceUpdate 是否强制刷新，默认为false
     */
    public refreshDocumentView(docPath: string, forceUpdate: boolean = false): void {
        // 查找文档容器
        const containers = document.querySelectorAll(`.document-images-container[data-doc-path="${docPath}"]`);
        if (containers.length === 0) {
            return;
        }
        
        // 遍历所有相关容器进行更新
        containers.forEach(container => {
            // 获取资源文件夹路径
            const folderPath = container.getAttribute('data-folder-path');
            if (!folderPath) {
                return;
            }
            
            // 如果forceUpdate为true，则直接更新
            if (forceUpdate) {
                this.updateImagesContainer(container as HTMLElement, folderPath, docPath);
                return;
            }
            
            // 获取当前版本
            const currentVersion = container.getAttribute('data-version');
            const lastUpdate = this.viewUpdateRegistry.get(docPath) || 0;
            
            // 判断是否需要更新
            if (!currentVersion || lastUpdate > parseInt(currentVersion)) {
                this.updateImagesContainer(container as HTMLElement, folderPath, docPath);
            }
        });
    }

    /**
     * 创建图片容器
     * @param options 容器配置选项
     * @returns 创建的容器元素
     */
    public createImageContainer(options: ImageContainerOptions): HTMLElement {
        const { docPath, folderPath, isExpanded = false, customClass = '' } = options;
        
        // 创建外层容器
        const container = document.createElement('div');
        container.classList.add('tree-item-children', 'nav-folder-children', 'document-images-container');
        if (customClass) {
            container.classList.add(customClass);
        }
        
        container.setAttribute('data-doc-path', docPath);
        container.setAttribute('data-folder-path', folderPath);
        container.classList.add(isExpanded ? 'visible' : 'hidden');
        
        // 创建占位元素，提供垂直空间
        const spacer = document.createElement('div');
        spacer.classList.add('document-spacer');
        container.appendChild(spacer);
        
        return container;
    }

    /**
     * 更新图片容器
     * @param container 容器元素
     * @param folderPath 文件夹路径
     * @param docPath 文档路径
     * @param handleError 自定义错误处理函数
     * @returns Promise<void>
     */
    public async updateImagesContainer(
        container: HTMLElement,
        folderPath: string,
        docPath: string,
        handleError?: (container: HTMLElement, message: string) => void
    ): Promise<void> {
        try {
            // 清空容器
            this.clearContainer(container);
            
            // 保留占位元素
            const spacer = document.createElement('div');
            spacer.classList.add('document-spacer');
            container.appendChild(spacer);
            
            // 检查资源文件夹是否存在
            const folder = this.app.vault.getAbstractFileByPath(folderPath);
            if (!folder || !(folder instanceof TFolder)) {
                return;
            }
            
            // 获取文件夹中的图片
            const images = await this.assetManager.getImagesInFolder(folderPath);
            
            // 再次确认容器仍然连接到DOM
            if (!container.isConnected) {
                return;
            }
            
            if (images.length > 0) {
                // 为每个图片创建元素
                for (const image of images) {
                    // 创建包装容器
                    const itemWrapper = document.createElement('div');
                    itemWrapper.classList.add('tree-item', 'nav-file');
                    
                    // 创建图片元素
                    const imageItem = this.createImageItem(image);
                    
                    // 添加到包装器
                    itemWrapper.appendChild(imageItem);
                    
                    // 添加到主容器
                    container.appendChild(itemWrapper);
                }
            }
            
            // 更新容器版本
            container.setAttribute('data-version', Date.now().toString());
            
            // 更新注册表
            this.viewUpdateRegistry.set(docPath, Date.now());
        } catch (error) {
            console.error('更新图片容器时出错:', error);
        }
    }

    /**
     * 清除容器内容并移除事件监听器
     * @param container 待清理的容器
     */
    public clearContainer(container: HTMLElement): void {
        // 解除所有元素的事件监听器
        const elements = container.querySelectorAll('*');
        elements.forEach(el => {
            // 替换元素以移除事件监听器
            if (el.parentNode) {
                const clone = el.cloneNode(false);
                while (el.firstChild) {
                    clone.appendChild(el.firstChild);
                }
                el.parentNode.replaceChild(clone, el);
            }
        });
        
        // 清空容器内容
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
    }

    /**
     * 创建图片项
     * @param image 图片文件
     */
    public createImageItem(image: TFile): HTMLElement {
        // 创建图片标题元素
        const imageTitle = document.createElement('div');
        imageTitle.classList.add('tree-item-self', 'nav-file-title', 'tappable', 'is-clickable', 'image-title');
        imageTitle.setAttribute('data-path', image.path);
        imageTitle.setAttribute('draggable', 'true');
        
        // 创建内容容器
        const innerContent = document.createElement('div');
        innerContent.classList.add('tree-item-inner', 'nav-file-title-content');
        
        // 提取文件名和扩展名
        const fileName = image.name.substring(0, image.name.lastIndexOf('.'));
        const fileExt = image.extension;
        
        // 设置文件名（不含扩展名）
        innerContent.textContent = fileName;
        
        // 创建扩展名标签
        const extTag = document.createElement('div');
        extTag.classList.add('nav-file-tag');
        extTag.textContent = fileExt;
        
        // 组装元素
        imageTitle.appendChild(innerContent);
        imageTitle.appendChild(extTag);
        
        // 添加点击事件
        imageTitle.addEventListener('click', (evt) => {
            // 如果正在编辑状态，不处理点击事件
            if (imageTitle.classList.contains('is-being-renamed')) {
                return;
            }
            
            evt.stopPropagation();
            evt.preventDefault();
            
            // 清除所有选中状态
            document.querySelectorAll('.document-images-container .is-active').forEach(el => {
                el.classList.remove('is-active');
            });
            
            // 设置当前项为选中状态
            imageTitle.classList.add('is-active');
            
            // 打开图片
            this.app.workspace.openLinkText(image.path, '', false);
        });

        // 添加右键菜单事件
        imageTitle.addEventListener('contextmenu', (evt) => {
            evt.preventDefault();
            evt.stopPropagation();

            // 创建Menu实例
            const menu = new Menu();

            // 添加重命名选项
            menu.addItem((item: any) => {
                item
                    .setTitle('重命名')
                    .setIcon('pencil')
                    .onClick(() => {
                        // 标记为编辑状态
                        imageTitle.classList.add('has-focus', 'is-being-renamed');
                        
                        // 保存原始文本用于取消操作
                        const originalText = fileName;
                        
                        // 使内容容器可编辑
                        innerContent.setAttribute('contenteditable', 'true');
                        innerContent.focus();
                        
                        // 选择所有文本
                        const selection = window.getSelection();
                        if (selection) {
                            const range = document.createRange();
                            range.selectNodeContents(innerContent);
                            selection.removeAllRanges();
                            selection.addRange(range);
                        }
                        
                        // 阻止input事件冒泡
                        const handleInput = (e: Event) => {
                            e.stopPropagation();
                            e.stopImmediatePropagation();
                        };
                        
                        // 阻止复合输入事件冒泡（用于输入法编辑器）
                        const handleComposition = (e: CompositionEvent) => {
                            e.stopPropagation();
                        };
                        
                        // 阻止其他相关事件冒泡
                        const preventPropagation = (e: Event) => {
                            e.stopPropagation();
                        };
                        
                        // 确保事件只被添加一次
                        innerContent.removeEventListener('input', handleInput);
                        innerContent.addEventListener('input', handleInput, true);
                        
                        innerContent.removeEventListener('compositionstart', handleComposition);
                        innerContent.removeEventListener('compositionupdate', handleComposition);
                        innerContent.removeEventListener('compositionend', handleComposition);
                        innerContent.addEventListener('compositionstart', handleComposition, true);
                        innerContent.addEventListener('compositionupdate', handleComposition, true);
                        innerContent.addEventListener('compositionend', handleComposition, true);
                        
                        // 其他编辑相关事件
                        innerContent.removeEventListener('paste', preventPropagation);
                        innerContent.removeEventListener('cut', preventPropagation);
                        innerContent.removeEventListener('copy', preventPropagation);
                        innerContent.addEventListener('paste', preventPropagation, true);
                        innerContent.addEventListener('cut', preventPropagation, true);
                        innerContent.addEventListener('copy', preventPropagation, true);
                        
                        // 处理输入完成
                        const finishRenaming = async (save: boolean) => {
                            // 获取新文件名
                            const newName = save ? (innerContent.textContent || '').trim() : originalText;
                            
                            // 移除编辑状态
                            imageTitle.classList.remove('has-focus', 'is-being-renamed');
                            innerContent.removeAttribute('contenteditable');
                            
                            // 移除所有事件监听器
                            innerContent.removeEventListener('input', handleInput, true);
                            innerContent.removeEventListener('compositionstart', handleComposition, true);
                            innerContent.removeEventListener('compositionupdate', handleComposition, true);
                            innerContent.removeEventListener('compositionend', handleComposition, true);
                            innerContent.removeEventListener('paste', preventPropagation, true);
                            innerContent.removeEventListener('cut', preventPropagation, true);
                            innerContent.removeEventListener('copy', preventPropagation, true);
                            innerContent.removeEventListener('blur', handleBlur);
                            
                            // 重置内容为原始文件名，如果后续重命名成功会通过刷新视图更新
                            innerContent.textContent = fileName;
                            
                            // 如果文件名有变化且不为空，执行重命名
                            if (save && newName && newName !== fileName && newName.length > 0) {
                                try {
                                    // 使用Obsidian的fileManager执行重命名
                                    const newFileName = `${newName}.${fileExt}`;
                                    const newPath = image.parent 
                                        ? `${image.parent.path}/${newFileName}` 
                                        : newFileName;
                                    
                                    // 使用Obsidian的API执行实际重命名操作
                                    await this.app.fileManager.renameFile(image, newPath);
                                    
                                    // 刷新视图以显示新名称
                                    const folderPath = image.path.substring(0, image.path.lastIndexOf('/'));
                                    if (folderPath.endsWith(CONSTANTS.ASSETS_FOLDER_SUFFIX)) {
                                        const docPath = folderPath.substring(0, folderPath.lastIndexOf(CONSTANTS.ASSETS_FOLDER_SUFFIX)) + '.md';
                                        this.refreshDocumentView(docPath, true);
                                    }
                                } catch (error) {
                                    console.error('重命名图片失败:', error);
                                    new Notice(`重命名失败: ${error instanceof Error ? error.message : String(error)}`);
                                }
                            }
                        };
                        
                        // 处理回车键和Esc键
                        const handleKeyDown = (e: KeyboardEvent) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                e.stopPropagation(); // 阻止事件冒泡
                                // 先移除所有事件监听器，避免重复处理
                                innerContent.removeEventListener('keydown', handleKeyDown);
                                innerContent.removeEventListener('input', handleInput, true);
                                innerContent.removeEventListener('compositionstart', handleComposition, true);
                                innerContent.removeEventListener('compositionupdate', handleComposition, true);
                                innerContent.removeEventListener('compositionend', handleComposition, true);
                                innerContent.removeEventListener('paste', preventPropagation, true);
                                innerContent.removeEventListener('cut', preventPropagation, true);
                                innerContent.removeEventListener('copy', preventPropagation, true);
                                innerContent.removeEventListener('blur', handleBlur);
                                finishRenaming(true);
                            } else if (e.key === 'Escape') {
                                e.preventDefault();
                                e.stopPropagation(); // 阻止事件冒泡
                                // 先移除所有事件监听器，避免重复处理
                                innerContent.removeEventListener('keydown', handleKeyDown);
                                innerContent.removeEventListener('input', handleInput, true);
                                innerContent.removeEventListener('compositionstart', handleComposition, true);
                                innerContent.removeEventListener('compositionupdate', handleComposition, true);
                                innerContent.removeEventListener('compositionend', handleComposition, true);
                                innerContent.removeEventListener('paste', preventPropagation, true);
                                innerContent.removeEventListener('cut', preventPropagation, true);
                                innerContent.removeEventListener('copy', preventPropagation, true);
                                innerContent.removeEventListener('blur', handleBlur);
                                finishRenaming(false);
                            }
                        };
                        
                        // 确保事件只被添加一次
                        innerContent.removeEventListener('keydown', handleKeyDown);
                        innerContent.addEventListener('keydown', handleKeyDown);
                        
                        // 处理失焦事件
                        const handleBlur = () => {
                            // 检查元素是否仍然存在于DOM中
                            if (document.body.contains(innerContent)) {
                                // 移除事件监听器，避免重复处理
                                innerContent.removeEventListener('blur', handleBlur);
                                innerContent.removeEventListener('keydown', handleKeyDown);
                                innerContent.removeEventListener('input', handleInput, true);
                                innerContent.removeEventListener('compositionstart', handleComposition, true);
                                innerContent.removeEventListener('compositionupdate', handleComposition, true);
                                innerContent.removeEventListener('compositionend', handleComposition, true);
                                innerContent.removeEventListener('paste', preventPropagation, true);
                                innerContent.removeEventListener('cut', preventPropagation, true);
                                innerContent.removeEventListener('copy', preventPropagation, true);
                                finishRenaming(true);
                            }
                        };
                        
                        // 确保事件只被添加一次
                        innerContent.removeEventListener('blur', handleBlur);
                        innerContent.addEventListener('blur', handleBlur);
                    });
            });

            // 添加删除选项
            menu.addItem((item: any) => {
                item
                    .setTitle('删除')
                    .setIcon('trash')
                    .onClick(() => {
                        // 创建确认对话框
                        const modal = new Modal(this.app);
                        modal.titleEl.setText('删除文件');
                        
                        const contentEl = modal.contentEl;
                        contentEl.empty();
                        
                        // 添加提示文本
                        contentEl.createEl('p', {text: `你确定要删除图片 "${fileName}.${fileExt}" 吗？`});
                        contentEl.createEl('p', {text: '它将被移动到系统回收站里。'});
                        
                        // 创建按钮容器
                        const buttonContainer = modal.modalEl.createEl('div', { cls: 'modal-button-container' });
                        
                        // 确认按钮
                        buttonContainer.createEl('button', {
                            text: '删除',
                            cls: 'mod-warning',
                            type: 'button'
                        }).addEventListener('click', async () => {
                            modal.close();
                            
                            try {
                                // 执行删除操作，使用trashFile遵循用户偏好
                                await this.app.fileManager.trashFile(image);
                                
                                // 获取相关文档路径并刷新视图
                                const folderPath = image.path.substring(0, image.path.lastIndexOf('/'));
                                if (folderPath.endsWith(CONSTANTS.ASSETS_FOLDER_SUFFIX)) {
                                    const docPath = folderPath.substring(0, folderPath.lastIndexOf(CONSTANTS.ASSETS_FOLDER_SUFFIX)) + '.md';
                                    this.refreshDocumentView(docPath, true);
                                }
                                
                                // new Notice('删除成功');
                            } catch (error) {
                                console.error('删除图片失败:', error);
                                new Notice(`删除失败: ${error instanceof Error ? error.message : String(error)}`);
                            }
                        });
                        
                        // 取消按钮
                        buttonContainer.createEl('button', {
                            text: '取消',
                            cls: 'mod-cancel',
                            type: 'button'
                        }).addEventListener('click', () => {
                            modal.close();
                        });
                        
                        modal.open();
                    });
            });

            // 显示菜单
            menu.showAtMouseEvent(evt);
        });
        
        return imageTitle;
    }

    /**
     * 刷新所有视图
     */
    public refreshAllViews(): void {
        // 查找所有文档容器
        document.querySelectorAll('.document-images-container').forEach(container => {
            const docPath = container.getAttribute('data-doc-path');
            if (docPath) {
                this.refreshDocumentView(docPath);
            }
        });
    }

    /**
     * 清理资源
     */
    public cleanup(): void {
        // 清除视图更新注册表
        this.viewUpdateRegistry.clear();
        window.removeEventListener(CONSTANTS.EVENTS.REFRESH_CONTAINERS, this.refreshContainersHandler);
        
        document.removeEventListener('click', this.documentClickHandler, true);
    }

    /**
     * 设置图片容器可见性
     * @param docPath 文档路径
     * @param isVisible 是否可见
     */
    public setContainerVisibility(docPath: string, isVisible: boolean): void {
        // 查找所有与文档相关的容器
        const containers = document.querySelectorAll(`.document-images-container[data-doc-path="${docPath}"]`);
        
        // 设置显示状态
        containers.forEach(container => {
            container.classList.remove(isVisible ? 'hidden' : 'visible');
            container.classList.add(isVisible ? 'visible' : 'hidden');
            
            // 如果要显示且容器为空，则尝试加载内容
            if (isVisible && container.children.length <= 1) { // 只有占位符时视为空
                const folderPath = container.getAttribute('data-folder-path');
                if (folderPath) {
                    this.updateImagesContainer(container as HTMLElement, folderPath, docPath);
                }
            }
        });
    }
}
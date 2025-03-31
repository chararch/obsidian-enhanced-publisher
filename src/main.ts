import { 
	App, 
	MarkdownView, 
	Notice, 
	Plugin, 
	TFile, 
	TFolder,
	addIcon,
	WorkspaceLeaf,
	Hotkey
} from 'obsidian';

// 导入设置相关模块
import { EnhancedPublisherSettings, DEFAULT_SETTINGS, EnhancedPublisherSettingTab } from './settings';

// 导入图片处理模块
import { handlePasteEvent } from './image-handler';

// 导入HTML预览模块
import { showHtmlPreview, markdownToHtml, HTML_PREVIEW_VIEW_TYPE, HtmlPreviewView } from './html-preview';

// 导入发布功能
import { showPublishModal } from './publisher';
import { publishToWechat } from './publisher/wechat';

// 导入常量
import { CONSTANTS } from './constants';

// 导入管理器
import { AssetManager } from './managers/asset-manager';
import { DocumentManager } from './managers/document-manager';
import { FileExplorerEnhancer } from './managers/file-explorer-enhancer';
import { ViewManager } from './managers/view-manager';
import { EventManager } from './managers/event-manager';

export default class EnhancedPublisherPlugin extends Plugin {
	settings: EnhancedPublisherSettings;
    
    // 管理器实例
    assetManager: AssetManager;
    documentManager: DocumentManager;
    fileExplorerEnhancer: FileExplorerEnhancer;
    viewManager: ViewManager;
    eventManager: EventManager;
    
    // 导出功能，便于其他模块调用
    showPublishModal = showPublishModal;

	async onload() {
		console.log('加载增强发布插件');
        
        // 1. 加载设置
		await this.loadSettings();

        // 2. 初始化管理器
        this.initializeManagers();
        
        // 3. 添加图标
        this.registerIcons();
        
        // 4. 注册功能
        this.registerFeatures();
        
        // 5. 延迟初始化文件浏览器增强
        this.initializeFileExplorer();
        
        // 6. 注册HTML预览视图
        this.registerView(
            HTML_PREVIEW_VIEW_TYPE,
            (leaf) => new HtmlPreviewView(leaf, this, '', 'HTML预览', null)
        );
    }

    private initializeManagers(): void {
        // 创建管理器实例
        this.assetManager = new AssetManager(this.app);
        this.viewManager = new ViewManager(this.app, this.assetManager);
        this.documentManager = new DocumentManager(this.app, this.assetManager);
        this.fileExplorerEnhancer = new FileExplorerEnhancer(
            this.app, 
            this.assetManager,
            this.viewManager
        );
        this.eventManager = new EventManager(
            this.app,
            this,
            this.assetManager,
            this.documentManager,
            this.fileExplorerEnhancer,
            this.viewManager
        );
        
        // 初始化管理器
        this.assetManager.initialize();
        this.viewManager.initialize();
        this.eventManager.registerEvents();
    }

    private registerIcons(): void {
        // 添加插件图标
        addIcon('enhanced-publisher', '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>');
        
        // 添加文档图标
        addIcon('file-with-images', '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><circle cx="10" cy="13" r="2"/><path d="M8 21l4-4 4 4"/></svg>');
    }

    private registerFeatures(): void {
        // 注册粘贴事件处理
		this.registerEvent(
			this.app.workspace.on('editor-paste', (evt, editor, markdownView) => {
				console.log('捕获粘贴事件');
				handlePasteEvent.call(this, evt, editor, markdownView);
			})
		);

        // 添加HTML预览命令
		this.addCommand({
			id: 'preview-as-html',
			name: '以HTML形式预览',
            hotkeys: [{modifiers: ["Shift"], key: "p"}],
			checkCallback: (checking: boolean) => {
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					if (!checking) {
						showHtmlPreview.call(this, markdownView);
					}
					return true;
				}
				return false;
			}
		});

        // 添加发布命令
		this.addCommand({
			id: 'publish-to-platform',
			name: '发布到内容平台',
            hotkeys: [{modifiers: ["Ctrl"], key: "p"}],
			checkCallback: (checking: boolean) => {
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					if (!checking) {
						showPublishModal.call(this, markdownView);
					}
					return true;
				}
				return false;
			}
		});

		// 添加设置选项卡
		this.addSettingTab(new EnhancedPublisherSettingTab(this.app, this));

		// 添加右键菜单
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				if (file instanceof TFile && file.extension === 'md') {
					// 添加HTML预览菜单项
					menu.addItem((item) => {
						item
							.setTitle('以HTML形式预览')
							.setIcon('enhanced-publisher')
							.onClick(() => {
								const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
								if (markdownView && markdownView.file === file) {
									showHtmlPreview.call(this, markdownView);
								} else {
									this.app.workspace.openLinkText(file.path, '', false).then(() => {
										const newView = this.app.workspace.getActiveViewOfType(MarkdownView);
										if (newView) {
											showHtmlPreview.call(this, newView);
										}
									});
								}
							});
					});
					
					// 添加发布菜单项
					menu.addItem((item) => {
						item
							.setTitle('发布到内容平台')
							.setIcon('enhanced-publisher')
							.onClick(() => {
								const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
								if (markdownView && markdownView.file === file) {
									showPublishModal.call(this, markdownView);
								} else {
									this.app.workspace.openLinkText(file.path, '', false).then(() => {
										const newView = this.app.workspace.getActiveViewOfType(MarkdownView);
										if (newView) {
											showPublishModal.call(this, newView);
										}
									});
								}
							});
					});
				}
			})
		);
    }

    private initializeFileExplorer(): void {
        // 使用Obsidian的布局就绪回调，确保DOM已完全加载和渲染
        this.app.workspace.onLayoutReady(() => {
            // 初始化文件浏览器增强
            this.fileExplorerEnhancer.initialize(this.settings.hideImageFolders);
            console.log('文件浏览器增强已初始化');
        });
    }

	onunload() {
		console.log('卸载增强发布插件');
        
        // 清理各管理器资源
        this.fileExplorerEnhancer.cleanup();
        this.viewManager.cleanup();
        this.eventManager.cleanup();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
        // 保存设置
		await this.saveData(this.settings);

		console.log('设置已保存，正在刷新文件浏览器视图');
        
        // 清理当前增强器
        this.fileExplorerEnhancer.cleanup();
        
        // 重新初始化，传入新的设置
        this.fileExplorerEnhancer.initialize(this.settings.hideImageFolders);
        
        // 触发刷新所有容器
        window.dispatchEvent(new CustomEvent(CONSTANTS.EVENTS.REFRESH_CONTAINERS));
        
        // 如果开启了隐藏图片文件夹功能，只在布局就绪后执行增强
        // 避免多次调用造成重复处理
        if (this.settings.hideImageFolders) {
            console.log('等待布局就绪后执行文件浏览器增强');
            
            // 触发布局变化
            this.app.workspace.trigger('layout-change');
            
            // 使用布局就绪回调确保DOM已更新
            this.app.workspace.onLayoutReady(() => {
                console.log('布局就绪，执行文件浏览器增强');
                this.fileExplorerEnhancer.enhanceFileExplorer();
            });
        }
    }

	// 包装微信发布功能供UI调用
	async publishToWechat(title: string, content: string, thumbMediaId: string = '', file: TFile): Promise<boolean> {
		return publishToWechat.call(this, title, content, thumbMediaId, file);
	}
}

// 导出插件类型
export type { EnhancedPublisherPlugin };
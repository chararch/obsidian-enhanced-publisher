import {
	App,
	MarkdownView,
	Notice,
	Plugin,
	TFile,
	TFolder,
	addIcon,
	WorkspaceLeaf,
	Hotkey,
	Editor,
	Setting
} from 'obsidian';

// 导入设置相关模块
import { EnhancedPublisherSettings, DEFAULT_SETTINGS, EnhancedPublisherSettingTab } from './settings';

// 导入图片处理模块
import { handlePasteEvent } from './image-handler';

// 导入HTML预览模块
import { showHtmlPreview, markdownToHtml, HTML_PREVIEW_VIEW_TYPE, HtmlPreviewView } from './html-preview';

// 导入发布功能
import { showPublishModal } from './publisher';
import { WechatPublisher } from './publisher/wechat';

// 导入常量
import { CONSTANTS } from './constants';

// 导入管理器
import { AssetManager } from './managers/asset-manager';
import { DocumentManager } from './managers/document-manager';
import { FileExplorerEnhancer } from './managers/file-explorer-enhancer';
import { ViewManager } from './managers/view-manager';
import { EventManager } from './managers/event-manager';

// 导入日志工具类
import { Logger } from './utils/logger';

export default class EnhancedPublisherPlugin extends Plugin {
	settings: EnhancedPublisherSettings;

	// 管理器实例
	assetManager: AssetManager;
	documentManager: DocumentManager;
	fileExplorerEnhancer: FileExplorerEnhancer;
	viewManager: ViewManager;
	eventManager: EventManager;

	// 发布器实例
	wechatPublisher: WechatPublisher;

	// 日志工具实例
	logger: Logger;

	// 导出功能，便于其他模块调用
	showPublishModal = showPublishModal;

	async onload() {
		// 初始化日志工具
		this.logger = Logger.getInstance(this.app);
		this.logger.info('加载增强发布插件');

		// 1. 加载设置
		await this.loadSettings();
		this.logger.debug('插件设置已加载');

		// 2. 初始化管理器
		this.initializeManagers();
		this.logger.debug('插件管理器已初始化');

		// 3. 添加图标
		this.registerIcons();
		this.logger.debug('插件图标已注册');

		// 4. 注册功能
		this.registerFeatures();
		this.logger.debug('插件功能已注册');

		// 5. 延迟初始化文件浏览器增强
		this.initializeFileExplorer();
		this.logger.debug('文件浏览器增强已初始化');

		// 6. 注册HTML预览视图
		this.registerView(
			HTML_PREVIEW_VIEW_TYPE,
			(leaf) => new HtmlPreviewView(leaf, this, '', 'HTML预览', null)
		);

		// 7. 初始化发布器
		this.wechatPublisher = new WechatPublisher(this.app, this);
	}

	private initializeManagers(): void {
		// 创建管理器实例
		this.assetManager = new AssetManager(this.app, this.settings);

		// 初始化ViewManager
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
				this.logger.debug('捕获粘贴事件');
				handlePasteEvent.call(this, evt, editor, markdownView);
			})
		);

		// 添加HTML预览命令
		this.addCommand({
			id: 'preview-as-html',
			name: '以HTML形式预览',
			editorCheckCallback: (checking: boolean, editor: Editor, view: MarkdownView) => {
				if (checking) {
					return true;
				}
				showHtmlPreview.call(this, view);
				return true;
			}
		});

		// 添加发布命令
		this.addCommand({
			id: 'publish-to-platform',
			name: '发布到内容平台',
			editorCheckCallback: (checking: boolean, editor: Editor, view: MarkdownView) => {
				if (checking) {
					return true;
				}
				showPublishModal.call(this, view);
				return true;
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
							.onClick(async () => {
								const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
								if (markdownView && markdownView.file === file) {
									showHtmlPreview.call(this, markdownView);
								} else {
									try {
										await this.app.workspace.openLinkText(file.path, '', false);
										const newView = this.app.workspace.getActiveViewOfType(MarkdownView);
										if (newView) {
											showHtmlPreview.call(this, newView);
										}
									} catch (error) {
										this.logger.error('打开文件失败:', error);
									}
								}
							});
					});

					// 添加发布菜单项
					menu.addItem((item) => {
						item
							.setTitle('发布到内容平台')
							.setIcon('enhanced-publisher')
							.onClick(async () => {
								const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
								if (markdownView && markdownView.file === file) {
									showPublishModal.call(this, markdownView);
								} else {
									try {
										await this.app.workspace.openLinkText(file.path, '', false);
										const newView = this.app.workspace.getActiveViewOfType(MarkdownView);
										if (newView) {
											showPublishModal.call(this, newView);
										}
									} catch (error) {
										this.logger.error('打开文件失败:', error);
									}
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
			this.logger.debug('文件浏览器增强已初始化');
		});
	}

	onunload() {
		this.logger.info('卸载增强发布插件');

		// 清理各管理器资源
		this.fileExplorerEnhancer.cleanup();
		this.viewManager.cleanup();
		this.eventManager.cleanup();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this.logger.setDebugMode(this.settings.debugMode);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.logger.setDebugMode(this.settings.debugMode);
		this.logger.debug('设置已保存，正在刷新文件浏览器视图');
		await this.fileExplorerEnhancer.refreshView();
	}

	// 包装微信发布功能供UI调用
	async publishToWechat(title: string, content: string, thumbMediaId: string = '', file: TFile): Promise<boolean> {
		return this.wechatPublisher.publishToWechat(title, content, thumbMediaId, file);
	}
}

// 导出插件类型
export type { EnhancedPublisherPlugin };